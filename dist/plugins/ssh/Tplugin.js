"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ThttpPlugin_1 = require("../ThttpPlugin");
const WorkerApplication_1 = require("../../WorkerApplication");
const Files_1 = require("../../utils/Files");
const HttpTools_1 = require("../../utils/HttpTools");
const fs = require("fs-extra");
const p = require("path");
const Errors = require("../../Errors");
const Promise = require("bluebird");
const SshConnection_1 = require("./SshConnection");
const bodyParser = require("body-parser");
const ws = require("ws");
const SshSession_1 = require("./SshSession");
const net = require("net");
const Timer_1 = require("../../utils/Timer");
const http = require("http");
const https = require("https");
class Tplugin extends ThttpPlugin_1.ThttpPlugin {
    constructor(application, config) {
        super(application, config);
        this.sshKeysDir = null;
        this.defaultPort = 22;
        this.connectTimeout = 10000;
        this.sshSessions = new Map();
        this.connections = new Map();
        this.cachedConnectionTimeout = 3600;
        this.purgeConnectionsTimerInterval = 60;
        this.statInterval = 300;
        this.lastStatDate = new Date().getTime();
        this.totalRequests = 0;
        this.cacheHits = 0;
        if (this.config.sshKeysDir) {
            this.sshKeysDir = this.config.sshKeysDir;
        }
        else {
            this.sshKeysDir = WorkerApplication_1.WorkerApplication.getConfigDir() + '/sshKeys';
        }
    }
    onPurgeConnectionsTimer() {
        let nowTimestamp = new Date().getTime();
        this.connections.forEach((connection, key) => {
            let diffSec = (nowTimestamp - connection.lastUse) / 1000;
            if (diffSec > this.cachedConnectionTimeout) {
                let diffString = Math.round(diffSec / 60) + ' min';
                this.logger.info("Destroy connection " + connection.toString() + ' (inactive depuis ' + diffString + ')');
                this.destroyConnection(connection);
            }
        });
        let diffLastStat = (nowTimestamp - this.lastStatDate) / 1000;
        if (diffLastStat > this.statInterval) {
            let reqRate = Math.round(10 * this.totalRequests / diffLastStat) / 10;
            let cacheHitRatio = 0;
            if (this.totalRequests > 0)
                cacheHitRatio = Math.round(1000 * this.cacheHits / this.totalRequests) / 10;
            this.logger.info("Requests rate: " + reqRate + "/sec, cacheHitRatio: " + cacheHitRatio + "%, connexions SSH en cache: " + this.connections.size);
            this.lastStatDate = new Date().getTime();
            this.totalRequests = 0;
            this.cacheHits = 0;
        }
    }
    install() {
        super.install();
        this.purgeConnectionsTimer = new Timer_1.default({ delay: this.purgeConnectionsTimerInterval * 1000 });
        this.purgeConnectionsTimer.on(Timer_1.default.ON_TIMER, this.onPurgeConnectionsTimer.bind(this));
        this.purgeConnectionsTimer.start();
        this.app.use(bodyParser.json({
            limit: '500mb'
        }));
        this.app.get('/stats', this._stats.bind(this));
        this.app.get('/shell', this._shell.bind(this));
        this.app.post('/exec', this.exec.bind(this));
        this.app.post('/execMulti', this.execMulti.bind(this));
        this.app.get('/download', this.download.bind(this));
        this.app.get('/sftpReaddir', this.sftpReaddir.bind(this));
        this.app.post('/upload', this.upload.bind(this));
        this.app.post('/checkLogin', this.checkLogin.bind(this));
        this.app.post('/checkLogins', this.checkLogins.bind(this));
        this.app.get('/httpForward', this.httpForward.bind(this));
        this.websocketDataServer = new ws.Server({
            server: this.application.httpServer.server,
            noServer: true,
            perMessageDeflate: false,
            path: '/sshSocket',
            verifyClient: this.verifyClient.bind(this)
        });
        this.websocketDataServer.on('connection', this.onDataConnection.bind(this));
    }
    httpForward(req, res, next) {
        let params = HttpTools_1.HttpTools.getQueryParams(req, {
            host: {
                type: 'string'
            },
            port: {
                default: this.defaultPort,
                type: 'integer'
            },
            username: {
                type: 'string'
            },
            password: {
                default: null,
                type: 'string'
            },
            key: {
                default: null,
                type: 'string'
            },
            passphrase: {
                default: null,
                type: 'string'
            },
            url: {
                type: 'string'
            },
            method: {
                type: 'string',
                default: 'get'
            }
        });
        let sshOptions = {
            host: params.host,
            port: params.port,
            username: params.username,
            password: params.password
        };
        let isHttps;
        if (params.url.toLowerCase().startsWith('https://')) {
            isHttps = true;
        }
        else if (params.url.toLowerCase().startsWith('http://')) {
            isHttps = false;
        }
        else
            throw "url incorrecte: doit commencer par https:// ou http://";
        this.getConnection(sshOptions)
            .then((connection) => {
            let agent = connection.getHttpAgent(isHttps);
            let opt = {
                agent: agent,
                method: params.method.toUpperCase()
            };
            let httpObject;
            if (!isHttps)
                httpObject = http;
            else
                httpObject = https;
            httpObject.get(params.url, opt, (response) => {
                let data = [];
                response.on('data', (chunk) => {
                    data.push(chunk);
                });
                response.on('end', () => {
                    for (let k in response.headers) {
                        res.setHeader(k, response.headers[k]);
                    }
                    res.end(Buffer.concat(data));
                });
            })
                .on('error', (err) => {
                console.log(err);
                next(err);
            });
        })
            .catch((err) => {
            next(err);
        });
    }
    createTcpServer() {
        var server = net.createServer((client) => {
            console.log('Client connect. Client local address : ' + client.localAddress + ':' + client.localPort + '. client remote address : ' + client.remoteAddress + ':' + client.remotePort);
            client.on('data', (data) => {
                if (data.toString() === 'toto') {
                    this.logger.error("!!!!!!!!! " + data.toString());
                }
                else {
                    this.logger.error(data);
                    this.sshSessions.forEach((sess, key) => {
                        if (sess.stream)
                            sess.stream.write(data);
                    });
                }
            });
            client.on('end', () => {
                console.log('Client disconnect.');
                server.getConnections((err, count) => {
                    if (!err) {
                        console.log("There are %d connections now. ", count);
                    }
                    else {
                        console.error(JSON.stringify(err));
                    }
                });
            });
            client.on('timeout', () => {
                console.log('Client request time out. ');
            });
        });
        server.listen(9999, () => {
            var serverInfo = server.address();
            var serverInfoJson = JSON.stringify(serverInfo);
            console.log('TCP server listen on address : ' + serverInfoJson);
            server.on('close', () => {
                console.log('TCP server socket is closed.');
            });
            server.on('error', (error) => {
                console.error(JSON.stringify(error));
            });
        });
    }
    onDataConnection(conn, req) {
        let sshSession = new SshSession_1.SshSession(this.application, conn, req);
        this.sshSessions.set(sshSession.id, sshSession);
        sshSession.on('close', () => {
            this.sshSessions.delete(sshSession.id);
            sshSession.removeAllListeners();
            conn.terminate();
        });
        sshSession.init();
    }
    verifyClient(info, done) {
        done(true);
    }
    _stats(req, res, next) {
        let r = {
            connections: {
                count: this.connections.size
            }
        };
        res.json(r);
    }
    upload(req, res, next) {
        let params = HttpTools_1.HttpTools.getQueryParams(req, {
            path: {
                type: 'string'
            },
            host: {
                type: 'string'
            },
            port: {
                default: this.defaultPort,
                type: 'integer'
            },
            username: {
                type: 'string'
            },
            password: {
                default: null,
                type: 'string'
            },
            overwrite: {
                default: true,
                type: 'boolean'
            },
            key: {
                default: null,
                type: 'string'
            },
            passphrase: {
                default: null,
                type: 'string'
            }
        });
        let uploadedFile = null;
        HttpTools_1.HttpTools.saveUploadedFile(req, res, next)
            .then((result) => {
            if (result.files.length === 0) {
                throw new Errors.HttpError('No file uploaded', 400);
            }
            else {
                uploadedFile = result.files[0];
                this.logger.info('Upload File [' + uploadedFile.name + ']');
                if (!params.overwrite) {
                    return this.remoteFileExists(params.host, params.username, params.password, params.key, params.passphrase, params.path, params.port);
                }
                else {
                    return Promise.resolve(null);
                }
            }
        })
            .then((fileExists = null) => {
            if (!fileExists) {
                return this.scpSend(params.host, params.username, params.password, params.key, params.passphrase, uploadedFile.path, params.path, params.port);
            }
            else {
                throw new Errors.HttpError('File already exists: ' + params.path + ' (use \'overwrite\' option)', 400);
            }
        })
            .then((result) => {
            this.logger.info('scpSend OK to ' + params.host + params.path);
            let r = {
                host: params.host,
                files: [{
                        name: uploadedFile.name,
                        path: params.path,
                        size: Files_1.Files.getFileSize(uploadedFile.path)
                    }]
            };
            res.status(200).json(r);
        })
            .finally(() => {
            if (uploadedFile.path) {
                this.removeTempFileSync(uploadedFile.path);
            }
        })
            .catch((err) => {
            next(err);
        });
    }
    remoteFileExists(host, username, password, key, passphrase, remotePath, port) {
        let filename = p.basename(remotePath);
        let rep = p.dirname(remotePath);
        let script = `cd ${rep}
		if [ $? -ne 0 ]; then
		exit 99
		fi
		ls ${filename}
		`;
        return this._exec({
            host: host,
            username: username,
            password: password,
            key: key,
            passphrase: passphrase,
            script: script,
            port: port,
            logError: true,
            pty: false
        })
            .then((result) => {
            if (result.exitCode === 99) {
                throw 'Cannot access directory : ' + result.stderr;
            }
            return (result.exitCode === 0);
        });
    }
    download(req, res, next) {
        let params = HttpTools_1.HttpTools.getQueryParams(req, {
            path: {
                type: 'string'
            },
            compress: {
                default: false,
                type: 'boolean'
            },
            host: {
                type: 'string'
            },
            port: {
                default: this.defaultPort,
                type: 'integer'
            },
            username: {
                type: 'string'
            },
            password: {
                default: null,
                type: 'string'
            },
            overwrite: {
                default: true,
                type: 'boolean'
            },
            key: {
                default: null,
                type: 'string'
            },
            passphrase: {
                default: null,
                type: 'string'
            }
        });
        this.logger.info('ssh download remotePath=' + params.path + ' on ' + params.host + ':' + params.port + ',compress=' + params.compress);
        let filename = Files_1.Files.getFileName(params.path);
        let localdir = this.tmpDir + '/' + Math.random();
        let localPath = localdir + '/' + filename;
        fs.ensureDirSync(localdir);
        this.scpGet(params.host, params.username, params.password, params.key, params.passphrase, localPath, params.path, params.port)
            .then(() => {
            if (params.compress) {
                let zipFileName = filename + '.zip';
                HttpTools_1.HttpTools.sendZipFile(res, next, localPath, zipFileName)
                    .finally(() => {
                    this.removeTempDir(localdir);
                });
            }
            else {
                res.attachment(filename).sendFile(filename, {
                    root: localdir
                }, (err) => {
                    this.removeTempDir(localdir);
                    if (err) {
                        throw new Errors.HttpError(err.toString());
                    }
                });
            }
        })
            .catch(err => {
            next(err);
        });
    }
    exec(req, res, next) {
        let params = HttpTools_1.HttpTools.getBodyParams(req, {
            host: {
                type: 'string'
            },
            port: {
                default: this.defaultPort,
                type: 'integer'
            },
            username: {
                type: 'string'
            },
            password: {
                default: null,
                type: 'string'
            },
            key: {
                default: null,
                type: 'string'
            },
            passphrase: {
                default: null,
                type: 'string'
            },
            pty: {
                default: false,
                type: 'boolean'
            },
            script: {
                type: 'string'
            }
        });
        this._exec({
            host: params.host,
            username: params.username,
            password: params.password,
            key: params.key,
            passphrase: params.passphrase,
            script: params.script,
            port: params.port,
            pty: params.pty
        })
            .then((result) => {
            this.logger.info('Succès exec ssh sur ' + req.body.host + ' (username=' + req.body.username + ')');
            res.status(200).json(result);
        })
            .catch(err => {
            next(err);
        });
    }
    checkLogin(req, res, next) {
        let params = HttpTools_1.HttpTools.getBodyParams(req, {
            host: {
                type: 'string'
            },
            port: {
                default: this.defaultPort,
                type: 'integer'
            },
            username: {
                type: 'string'
            },
            password: {
                default: null,
                type: 'string'
            },
            key: {
                default: null,
                type: 'string'
            },
            passphrase: {
                default: null,
                type: 'string'
            }
        });
        this.getConnection(params, { closeConnection: true })
            .then(() => {
            this.logger.info('checkLogin ' + params.username + '@' + params.host + ': OK');
            res.status(200).json({ result: true });
        })
            .catch((error) => {
            if (error.level === 'client-authentication') {
                error.result = false;
                res.status(200).json(error);
            }
            else {
                next(new Errors.HttpError(error.toString()));
            }
        });
    }
    checkLogins(req, res, next) {
        let params = HttpTools_1.HttpTools.getBodyParams(req, {
            host: {
                type: 'string'
            },
            port: {
                default: this.defaultPort,
                type: 'integer'
            },
            username: {
                type: 'string'
            },
            authList: {
                type: 'array'
            }
        });
        let promises = [];
        for (let i = 0; i < params.authList.length; i++) {
            let auth = params.authList[i];
            let opt = {
                host: params.host,
                port: params.port,
                username: params.username,
                password: auth.password,
                passphrase: auth.passphrase,
                key: auth.key
            };
            promises.push(this.checkConnection(opt));
        }
        Promise
            .all(promises)
            .then((result) => {
            let response = {
                host: params.host,
                port: params.port,
                username: params.username,
                OKindex: null,
                OKcount: 0,
                results: []
            };
            for (let i = 0; i < result.length; i++) {
                let item = result[i];
                let responseItem = {
                    result: item.result,
                    error: null,
                    password: req.body.authList[i].password || null,
                    key: req.body.authList[i].key || null,
                    passphrase: req.body.authList[i].passphrase || null,
                    mode: item.mode
                };
                if (item.result) {
                    response.OKcount++;
                    if (response.OKindex === null) {
                        response.OKindex = i;
                    }
                }
                else {
                    responseItem.error = item.error;
                }
                response.results.push(responseItem);
            }
            res.status(200).json(response);
        })
            .catch((err) => {
            next(err);
        });
    }
    execMulti(req, res, next) {
        let params = HttpTools_1.HttpTools.getBodyParams(req, {
            script: {
                type: 'string'
            },
            destinations: {
                type: 'array'
            }
        });
        this._execMulti(params.destinations, params.script)
            .then((result) => {
            res.status(200).json(result);
        })
            .catch((err) => {
            next(err);
        });
    }
    _execMulti(destinations, script) {
        return new Promise((resolve, reject) => {
            let promises = [];
            for (let i = 0; i < destinations.length; i++) {
                let dest = destinations[i];
                let opt = {
                    host: dest.host,
                    port: dest.port,
                    username: dest.username,
                    password: dest.password,
                    script: script
                };
                if (typeof dest.script !== 'undefined') {
                    opt.script = dest.script;
                }
                promises.push(this._exec(opt));
            }
            Promise.all(promises)
                .then((result) => {
                resolve(result);
            })
                .catch(error => {
                reject(error);
            });
        });
    }
    checkConnection(params) {
        return this.getConnection(params, { closeConnection: true })
            .then((sshConnection) => {
            return { result: true, params: params, error: null };
        })
            .catch((err) => {
            if (err.level === 'client-authentication') {
                return { result: false, params: params, error: err };
            }
            else {
                throw err;
            }
        });
    }
    destroyConnection(connection) {
        connection.destroy();
        this.connections.delete(connection.id);
    }
    getConnection(params, options = null) {
        try {
            this.totalRequests++;
            if (!params.port)
                params.port = this.defaultPort;
            let connection;
            let opt = {
                closeConnection: false,
                useCache: true
            };
            if (options) {
                Object.keys(options).forEach((k) => {
                    opt[k] = options[k];
                });
            }
            let useCache = (opt.useCache && (opt.closeConnection === false));
            let connectionId;
            if (useCache)
                connectionId = SshConnection_1.default.calcId(params);
            if (useCache && this.connections.has(connectionId)) {
                this.cacheHits++;
                connection = this.connections.get(connectionId);
                connection.lastUse = new Date().getTime();
            }
            else {
                connection = new SshConnection_1.default(params, {
                    logger: this.logger,
                    sshKeysDir: this.sshKeysDir,
                    connectTimeout: this.connectTimeout
                });
                if (useCache) {
                    this.connections.set(connectionId, connection);
                    connection.on('end', () => {
                        this.destroyConnection(connection);
                    });
                }
            }
            if (connection.isConnected()) {
                return Promise.resolve(connection);
            }
            else {
                return connection.connect()
                    .then((conn) => {
                    if (opt.closeConnection) {
                        this.destroyConnection(connection);
                    }
                    return connection;
                });
            }
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    _shell(req, res, next) {
        let params = HttpTools_1.HttpTools.getQueryParams(req, {
            host: {
                type: 'string'
            },
            port: {
                default: this.defaultPort,
                type: 'integer'
            },
            username: {
                type: 'string'
            },
            password: {
                default: null,
                type: 'string'
            },
            key: {
                default: null,
                type: 'string'
            },
            passphrase: {
                default: null,
                type: 'string'
            }
        });
        this.getConnection(params)
            .then((connection) => {
            let conn = connection.conn;
            conn.shell((err, stream) => {
                if (err)
                    throw err;
                stream.on('close', function () {
                    console.log('Stream :: close');
                });
                stream.on('data', function (data) {
                    r += data;
                    console.log("DATA" + data);
                });
                let count = 0;
                let r = '';
                let timer = setInterval(() => {
                    stream.write('ls -l;echo exitcode=$?\n');
                    count++;
                    if (count >= 10) {
                        clearInterval(timer);
                        setTimeout(() => {
                            res.send(r);
                            conn.end();
                        }, 1000);
                    }
                }, 20);
            });
        })
            .catch(err => {
            next(err);
        });
    }
    _exec(opt, sshConnection = null) {
        let defaultOpt = {
            pty: false,
            script: null,
            host: null,
            port: null,
            username: null,
            password: null,
            key: null,
            passphrase: null
        };
        Object.keys(defaultOpt).forEach(key => {
            if (typeof opt[key] === 'undefined') {
                opt[key] = defaultOpt[key];
            }
        });
        return this.getConnection({
            host: opt.host,
            port: opt.port,
            username: opt.username,
            password: opt.password,
            key: opt.key,
            passphrase: opt.passphrase
        })
            .then((connection) => {
            return connection.exec(opt);
        });
    }
    removeTempFileSync(path) {
        try {
            fs.unlinkSync(path);
        }
        catch (err) {
            this.logger.warn('Failed to remove temp file ' + path + ': ' + err.toString());
        }
    }
    removeTempDir(dir) {
        setTimeout(() => {
            try {
                if (fs.pathExistsSync(dir)) {
                    fs.removeSync(dir);
                }
            }
            catch (err) {
                this.logger.warn({ err: err }, 'Error removing temp directory' + err);
            }
        }, 30000);
    }
    sftpReaddir(req, res, next) {
        let params = HttpTools_1.HttpTools.getQueryParams(req, {
            path: {
                type: 'string'
            },
            host: {
                type: 'string'
            },
            port: {
                default: this.defaultPort,
                type: 'integer'
            },
            username: {
                type: 'string'
            },
            password: {
                default: null,
                type: 'string'
            },
            key: {
                default: null,
                type: 'string'
            },
            passphrase: {
                default: null,
                type: 'string'
            }
        });
        this.logger.info('ssh sftpReaddir path=' + params.path + ' on ' + params.host + ':' + params.port);
        let connection;
        this.getConnection({
            host: params.host,
            username: params.username,
            password: params.password,
            key: params.key,
            passphrase: params.passphrase,
            port: params.port
        }, { useCache: false })
            .then((result) => {
            connection = result;
            return connection.sftpReaddir(params.path);
        })
            .then(result => {
            res.status(200).json(result);
        })
            .catch(err => {
            next(err);
        })
            .finally(() => {
            if (connection)
                connection.destroy();
        });
    }
    getConnectionById(id) {
        let r = null;
        if (this.connections.has(id)) {
            r = this.connections.get(id);
        }
        return r;
    }
    scpSend(host, username, password, key, passphrase, localPath, remotePath, port, opt = {}) {
        let connection;
        return this.getConnection({
            host: host,
            username: username,
            password: password,
            key: key,
            passphrase: passphrase,
            port: port
        }, { useCache: false })
            .then((result) => {
            connection = result;
            return connection.scpSend(localPath, remotePath);
        })
            .finally(() => {
            if (connection)
                connection.destroy();
        });
    }
    scpGet(host, username, password, key, passphrase, localPath, remotePath, port) {
        let connection;
        return this.getConnection({
            host: host,
            username: username,
            password: password,
            key: key,
            passphrase: passphrase,
            port: port
        }, { useCache: false })
            .then((result) => {
            connection = result;
            return connection.scpGet(localPath, remotePath);
        })
            .finally(() => {
            if (connection)
                connection.destroy();
        });
    }
}
exports.Tplugin = Tplugin;
//# sourceMappingURL=Tplugin.js.map