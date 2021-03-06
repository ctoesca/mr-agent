"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerApplication = void 0;
const Application_1 = require("./Application");
const HttpServer_1 = require("./HttpServer");
const ThttpPlugin_1 = require("./plugins/ThttpPlugin");
const express = require("express");
const bodyParser = require("body-parser");
const moment = require("moment");
const portscanner = require("portscanner");
const fs = require("fs-extra");
const os = require("os");
const p = require("path");
const HttpTools_1 = require("./utils/HttpTools");
const Errors = require("./Errors");
const Updater_1 = require("./autoUpdate/Updater");
const ChildProcess_1 = require("./utils/ChildProcess");
const utils = require("./utils");
const net = require("net");
const urlParser = require("url");
class WorkerApplication extends Application_1.Application {
    constructor(configPath, opt = {}) {
        super(configPath, opt);
        this.httpServer = null;
        this.pluginsInstances = {};
        this.startDate = moment().format('YYYY-MM-DD HH:mm:ss');
    }
    start() {
        this.httpServer = new HttpServer_1.HttpServer(this.config);
        this.mainApi = express();
        this.mainApi.use(bodyParser.json({
            limit: '50mb'
        }));
        this.httpServer.addExpressApplication('/api', this.mainApi);
        this.initRoutes();
        return this.httpServer.createServer()
            .then(() => {
            this.loadPlugins();
            return this.httpServer.start()
                .then(() => {
                this.logger.debug('Application started');
                return this;
            });
        });
    }
    registerExpressPlugin(mounthPath, app) {
        this.httpServer.addExpressApplication(mounthPath, app);
    }
    getUrl() {
        return this.httpServer.getUrl();
    }
    loadPlugins() {
        Object.keys(this.config.plugins).forEach((pluginName) => {
            let opt = this.config.plugins[pluginName];
            if (typeof opt.enabled === 'undefined') {
                opt.enabled = true;
            }
            if (opt.enabled) {
                let classe = require('./plugins/' + pluginName + '/Tplugin').Tplugin;
                opt.name = pluginName;
                opt.tmpDir = this.config.tmpDir + '/plugins/' + pluginName;
                let instance = new classe(this, opt);
                this.pluginsInstances[pluginName] = instance;
                instance.install(this);
                if (instance instanceof ThttpPlugin_1.ThttpPlugin) {
                    let mountPath = '/_plugin/' + pluginName;
                    this.logger.info("'" + pluginName + "' plugin mounted on " + mountPath);
                    this.registerExpressPlugin('/_plugin/' + pluginName, instance.app);
                }
            }
        });
    }
    getPluginInstance(name) {
        let r = null;
        if (typeof this.pluginsInstances[name] !== 'undefined') {
            r = this.pluginsInstances[name];
        }
        return r;
    }
    stop() {
        if (utils.isWin()) {
            return ChildProcess_1.ChildProcess.execCmd(__dirname + '/../bin/agent.exe', ['stop', this.serviceName]);
        }
        else {
            process.exit(99);
        }
    }
    restart() {
        process.exit(98);
    }
    initRoutes() {
        this.mainApi.get('/test', (req, res, next) => {
            new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve('OK1');
                }, 1000);
                setTimeout(() => {
                    resolve('OK2');
                }, 2000);
            })
                .then((r) => {
                this.logger.error(r);
                res.status(200).send(r);
            })
                .catch((err) => {
                this.logger.error(err.toString());
                next('Echec : ' + err.toString());
            });
        });
        this.mainApi.get('/processIsRunning', (req, res, next) => {
            try {
                let params = HttpTools_1.HttpTools.getQueryParams(req, {
                    pid: {
                        type: 'integer'
                    }
                });
                let r = true;
                try {
                    process.kill(params.pid, 0);
                }
                catch (e) {
                    r = (e.code === 'EPERM');
                }
                res.json({
                    result: r
                });
            }
            catch (err) {
                next(err);
            }
        });
        this.mainApi.get('/check', (req, res) => {
            this.check(req, res);
        });
        this.mainApi.get('/checkAgent', (req, res) => {
            this.check(req, res);
        });
        this.mainApi.get('/checkPort', (req, res, next) => {
            let params = HttpTools_1.HttpTools.getQueryParams(req, {
                port: {
                    type: 'integer'
                },
                host: {
                    type: 'string'
                }
            });
            portscanner.checkPortStatus(params.port, params.host, function (error, status) {
                let result = {
                    result: null,
                    error: null,
                    status: status
                };
                if (error) {
                    result.error = error;
                }
                else {
                    result.result = (status === 'open');
                }
                res.status(200).send(result);
            });
        });
        this.mainApi.get('/checkTcp', (req, res, next) => {
            let params = HttpTools_1.HttpTools.getQueryParams(req, {
                port: {
                    type: 'integer'
                },
                host: {
                    type: 'string'
                },
                timeout: {
                    type: 'integer',
                    default: 10000
                }
            });
            this.logger.info('checkTcp ' + params.host + ':' + params.port);
            let start = new Date();
            let u = urlParser.parse(req.url, true);
            for (let k in u.query) {
                if (params[k] === undefined)
                    params[k] = u.query[k];
            }
            let r = {
                result: false,
                error: null,
                responseTime: null
            };
            let timer = setTimeout(() => {
                let err = new Error('Timeout');
                err.toString = () => {
                    return 'Timeout';
                };
                socket.destroy(err);
            }, params.timeout);
            let socket = net.connect(params);
            socket.on('error', (err) => {
                clearTimeout(timer);
                r.result = false;
                r.responseTime = new Date().getTime() - start.getTime();
                r.error = err.toString() + ' after ' + r.responseTime + ' ms';
                res.status(200).send(r);
            });
            socket.on('connect', () => {
                clearTimeout(timer);
                r.result = true;
                r.responseTime = new Date().getTime() - start.getTime();
                res.status(200).send(r);
                socket.destroy();
            });
        });
        this.mainApi.post('/admin/update', (req, res, next) => {
            let updater = new Updater_1.Updater(this);
            updater.onUpdateRequest(req, res, next);
        });
        this.mainApi.get('/admin/os/cpus', (req, res, next) => {
            let r = os.cpus();
            for (let i = 0; i < r.length; i++) {
                let cpu = r[i];
                cpu.total = 0;
                Object.keys(cpu.times).forEach((k) => {
                    cpu.total += cpu.times[k];
                });
            }
            res.status(200).json(r);
        });
        this.mainApi.get('/admin/stop', (req, res, next) => {
            this.logger.info('STOP');
            this.stop()
                .then((result) => {
                if (result.exitCode === 0) {
                    res.status(200).send(result);
                }
                else {
                    res.status(500).send(result);
                }
            })
                .catch((err) => {
                next(err);
            });
        });
        this.mainApi.get('/admin/restart', (req, res, next) => {
            this.logger.info('RESTART');
            res.status(200).send('Restarting');
            this.restart();
        });
        this.mainApi.post('/getConfig', (req, res, next) => {
            let r = {
                data: fs.readFileSync(this.configPath).toString()
            };
            res.status(200).json(r);
        });
        this.mainApi.post('/setConfig', (req, res, next) => {
            let params = HttpTools_1.HttpTools.getBodyParams(req, {
                data: {
                    type: 'string'
                }
            });
            let path = this.configPath;
            let tmppath = p.normalize(this.config.tmpDir + '/config.tmp.js');
            try {
                if (fs.pathExistsSync(tmppath)) {
                    fs.unlinkSync(tmppath);
                }
                fs.writeFileSync(tmppath, params.data);
                if (typeof require.cache[tmppath] !== 'undefined') {
                    delete require.cache[tmppath];
                }
                let conf = require(tmppath);
                if (typeof conf.getConfig !== 'function') {
                    throw new Errors.HttpError("la config ne comporte pas de fonction 'getConfig'", 400);
                }
            }
            catch (err) {
                throw new Errors.HttpError(err.toString(), 400);
            }
            fs.writeFileSync(path, params.data);
            let r = {
                data: fs.readFileSync(path).toString()
            };
            res.status(200).json(r);
        });
    }
    check(req, res) {
        let result = {
            status: 0,
            installDir: p.normalize(__dirname + '/..'),
            version: Application_1.Application.version,
            startDate: this.startDate,
            userInfo: os.userInfo(),
            hostname: os.hostname(),
            nodeVersion: process.version,
            os: {
                platform: os.platform(),
                release: os.release()
            },
            cpus: os.cpus()
        };
        res.status(200).send(result);
    }
}
exports.WorkerApplication = WorkerApplication;
//# sourceMappingURL=WorkerApplication.js.map