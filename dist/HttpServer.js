"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Application_1 = require("./Application");
const Errors = require("./Errors");
const utils = require("./utils");
const EventEmitter = require("events");
const express = require("express");
const http = require("http");
const https = require("https");
const pem = require("pem");
const auth = require("basic-auth");
const morgan = require("morgan");
const rfs = require('rotating-file-stream');
class HttpServer extends EventEmitter {
    constructor(config) {
        super();
        this.config = {};
        this.auth = null;
        this.port = 3000;
        this.allowedIp = '.*';
        this.bindAddress = '0.0.0.0';
        this.httpsOptions = {
            'enabled': true,
            'pathOpenSSL': null,
            'days': 5000,
            'selfSigned': true
        };
        this.requestTimeout = 0;
        this.logger = null;
        this.config = config;
        this.logger = Application_1.Application.getLogger(this.constructor.name);
        if (arguments.length > 0) {
            if ((typeof this.config.auth !== 'undefined') && (typeof this.config.auth.username !== 'undefined') && (typeof this.config.auth.password !== 'undefined')) {
                this.auth = this.config.auth;
            }
            if (typeof this.config.port !== 'undefined') {
                this.port = this.config.port;
            }
            if (typeof this.config.allowedIp !== 'undefined') {
                this.allowedIp = this.config.allowedIp;
            }
            if (typeof this.config.bindAddress !== 'undefined') {
                this.bindAddress = this.config.bindAddress;
            }
            if (typeof this.config.https !== 'undefined') {
                Object.keys(this.config.https).forEach((k) => {
                    this.httpsOptions[k] = this.config.https[k];
                });
            }
            if (typeof this.config.requestTimeout !== 'undefined') {
                this.requestTimeout = this.config.requestTimeout;
            }
        }
        if (this.allowedIp === null) {
            this.logger.warn("Vérification de l'adresse IP désactivée");
        }
        else {
            this.logger.info('Allowed IP: ' + this.allowedIp);
        }
        if (this.auth === null) {
            this.logger.warn('Basic auth désactivé');
        }
        else {
            this.logger.info('Basic auth activé');
        }
        if ((this.allowedIp === null) && (this.auth === null)) {
            this.logger.error("Basic Auth et Vérification IP désactivés: l'agent ne sera pas utilisable");
        }
        this.app = express();
        if (this.config.logs && this.config.logs['http-access-log']) {
            let c = this.config.logs['http-access-log'];
            if (c.enabled) {
                this.logger.info('Activation logging HTTP acces', c);
                c.options.path = c['log-dir'];
                let logName = c['log-name'];
                let accessLogStream = rfs(logName, c.options);
                this.app.use(morgan('combined', { stream: accessLogStream }));
            }
        }
        this.app.use(this.authRequest.bind(this));
        this.createServer();
    }
    addExpressApplication(mounthPath, app) {
        this.app.use(mounthPath, app);
    }
    ipIsAllowed(ip) {
        if (this.allowedIp === null) {
            return false;
        }
        else {
            return new RegExp(this.allowedIp).test(ip);
        }
    }
    setErrorsHandlers() {
        this.app.use(function (req, res, next) {
            let err = new Errors.NotFound('Not Found');
            next(err);
        });
        this.app.use(function (err, req, res, next) {
            try {
                let status = 500;
                if (err instanceof Errors.HttpError) {
                    status = err.code;
                }
                else if (typeof err.getHttpStatus === 'function') {
                    status = err.getHttpStatus();
                }
                if (status >= 500) {
                    this.logger.error('***** ' + status + ' : ' + req.method + ' ' + req.path, err.toString());
                }
                else {
                    this.logger.warn('***** ' + status + ' : ' + req.method + ' ' + req.path, err.toString());
                }
                if (!res.headersSent) {
                    let response = {
                        error: true,
                        errorMessage: err.toString(),
                        code: status,
                        errorNum: 1,
                        errorClass: err.constructor.name,
                        stack: err.stack
                    };
                    if (typeof err.getDetail !== 'undefined') {
                        response.detail = err.getDetail();
                    }
                    res.status(status).send(response);
                }
                else {
                    this.logger.warn('***** ErrorHandler: Cannot set headers after they are sent to the client.');
                }
            }
            catch (err) {
                this.logger.error('HttpServer.onError: ' + err.toString());
            }
        }.bind(this));
    }
    authRequest(req, res, next) {
        let ip = utils.getIpClient(req);
        let authok = false;
        let IPok = this.ipIsAllowed(ip);
        if (!IPok) {
            let user = auth(req);
            authok = this.auth && user && (user.name === this.auth.username) && (user.pass === this.auth.password);
            if (authok) {
                authok = true;
            }
        }
        else {
            authok = true;
        }
        if (authok) {
            return next();
        }
        else {
            if (this.auth) {
                res.setHeader('WWW-Authenticate', 'Basic realm="mr-agent-realm"');
            }
            this.logger.warn('401 - Unauthorized ip=' + ip + ', user=' + auth(req));
            throw new Errors.HttpError('Unauthorized', 401);
        }
    }
    getUrl() {
        let r = '';
        if (this.httpsOptions.enabled) {
            r = 'https://';
        }
        else {
            r = 'http://';
        }
        if (this.bindAddress === '0.0.0.0') {
            r += '127.0.0.1';
        }
        else {
            r += this.bindAddress;
        }
        r += ':' + this.port;
        return r;
    }
    start() {
        this.server.setTimeout(this.requestTimeout * 1000);
        return this.listen();
    }
    createServer() {
        if (!this.httpsOptions.enabled) {
            this.server = http.createServer(this.app);
        }
        else {
            this.logger.info('https Options=', this.httpsOptions);
            if (this.httpsOptions.pathOpenSSL) {
                pem.config({
                    pathOpenSSL: this.httpsOptions.pathOpenSSL
                });
            }
            if (this.httpsOptions.credentials) {
                this.server = https.createServer(this.httpsOptions.credentials, this.app);
            }
            else {
                return new Promise((resolve, reject) => {
                    pem.createCertificate(this.httpsOptions, (err, keys) => {
                        if (err) {
                            this.logger.error(err, 'createCertificate');
                            process.exit(1);
                        }
                        else {
                            let credentials = { key: keys.serviceKey, cert: keys.certificate };
                            require('fs').writeFileSync(this.config.tmpDir + '/key.txt', keys.serviceKey);
                            require('fs').writeFileSync(this.config.tmpDir + '/cert.pem', keys.certificate);
                            this.logger.info("Le certificat HTTPS a été généré");
                            this.server = https.createServer(credentials, this.app);
                            resolve(this.server);
                        }
                    });
                });
            }
        }
        return Promise.resolve(this.server);
    }
    listen() {
        return new Promise((resolve, reject) => {
            this.server.on('error', (e) => {
                if (e.code === 'EADDRINUSE') {
                    this.logger.error('Port ' + this.port + ' in use');
                    process.exit(1);
                }
                else {
                    this.logger.error(e);
                    reject(e);
                }
            });
            this.server.listen(this.port, this.bindAddress, () => {
                this.setErrorsHandlers();
                this.logger.info('API Server started listening on ' + this.bindAddress + ':' + this.port);
                resolve();
            });
        });
    }
}
exports.HttpServer = HttpServer;
//# sourceMappingURL=HttpServer.js.map