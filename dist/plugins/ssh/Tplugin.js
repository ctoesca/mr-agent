"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tplugin = void 0;
const ThttpPlugin_1 = require("../ThttpPlugin");
const WorkerApplication_1 = require("../../WorkerApplication");
const Files_1 = require("../../utils/Files");
const HttpTools_1 = require("../../utils/HttpTools");
const fs = require("fs-extra");
const p = require("path");
const Errors = require("../../Errors");
const Promise = require("bluebird");
const SshConnection_1 = require("./SshConnection");
const SshError_1 = require("./SshError");
const bodyParser = require("body-parser");
const ws = require("ws");
const SshSession_1 = require("./SshSession");
const net = require("net");
const Timer_1 = require("../../utils/Timer");
const http = require("http");
const https = require("https");
const os = require("os");
const genericPool = require("generic-pool");
const utils = require("../../utils");
const gzip = require('zlib');
const SftpError_1 = require("./SftpError");
class Tplugin extends ThttpPlugin_1.ThttpPlugin {
    constructor(application, config) {
        super(application, config);
        this.sshKeysDir = null;
        this.defaultPort = 22;
        this.connectTimeout = 10000;
        this.sshSessions = new Map();
        this.pooledConnections = new Map();
        this.statTimerInterval = 60;
        this.statInterval = 300;
        this.lastStatDate = new Date().getTime();
        this.currentRequestsCount = 0;
        this.poolCacheHits = 0;
        this.connectCacheHits = 0;
        this.createdPools = 0;
        this.pools = new Map();
        this.poolsOptions = {
            acquireTimeoutMillis: 5000,
            evictionRunIntervalMillis: 60 * 1000,
            maxWaitingClients: 20,
            idleTimeoutMillis: 3600 * 1000,
            numTestsPerEvictionRun: 200,
            max: 5,
            min: 0,
            Promise: Promise
        };
        if (this.config.sshKeysDir) {
            this.sshKeysDir = this.config.sshKeysDir;
        }
        else {
            this.sshKeysDir = WorkerApplication_1.WorkerApplication.getConfigDir() + '/sshKeys';
        }
    }
    onStatTimer() {
        let nowTimestamp = new Date().getTime();
        let diffLastStat = (nowTimestamp - this.lastStatDate) / 1000;
        let reqRate = Math.round(10 * this.currentRequestsCount / diffLastStat) / 10;
        let poolCacheHitRatio = 0;
        let connectCacheHitRatio = 0;
        if (this.currentRequestsCount > 0) {
            poolCacheHitRatio = Math.round(1000 * this.poolCacheHits / this.currentRequestsCount) / 10;
            connectCacheHitRatio = Math.round(1000 * this.connectCacheHits / this.currentRequestsCount) / 10;
        }
        this.lastStatDate = new Date().getTime();
        this.currentRequestsCount = 0;
        this.poolCacheHits = 0;
        this.connectCacheHits = 0;
        SshConnection_1.default.stats.poolCacheHitsRatioPercent = poolCacheHitRatio;
        SshConnection_1.default.stats.connectCacheHitsRatioPercent = connectCacheHitRatio;
        SshConnection_1.default.stats.reqRatePerSec = reqRate;
        if (diffLastStat >= 300) {
            this.logger.info("Requests rate: " + reqRate + "/sec, poolCacheHitRatio: " + poolCacheHitRatio + "% connectCacheHitRatio: " + connectCacheHitRatio + "%");
            this.getStats()
                .then((stats) => {
                this.logger.info('POOLS STATS pid ' + process.pid + ' => size: ' + stats.poolsStats.connectionsSize + ', available: ' + stats.poolsStats.connectionsAvailable + ', borrowed: ' + stats.poolsStats.connectionsBorrowed + ', pending: ' + stats.poolsStats.connectionsPending);
            });
        }
    }
    razCache() {
        this.logger.info("RAZ Cache ...");
        this.pooledConnections.forEach((connection, id) => {
            connection.destroy();
            this.pooledConnections.delete(id);
        });
        this.pools.clear();
        return Promise.resolve({
            result: true
        });
    }
    getStats() {
        let r = {
            pid: process.pid,
            sshConnections: SshConnection_1.default.stats,
            poolsStats: {
                createdPools: this.createdPools,
                poolsCount: this.pools.size,
                connectionsBorrowed: 0,
                connectionsPending: 0,
                connectionsSize: 0,
                connectionsAvailable: 0
            }
        };
        this.pools.forEach((pool, id) => {
            r.poolsStats.connectionsBorrowed += pool.borrowed;
            r.poolsStats.connectionsPending += pool.pending;
            r.poolsStats.connectionsSize += pool.size;
            r.poolsStats.connectionsAvailable += pool.available;
        });
        return Promise.resolve(r);
    }
    install() {
        super.install();
        this.statTimer = new Timer_1.default({ delay: this.statTimerInterval * 1000 });
        this.statTimer.on(Timer_1.default.ON_TIMER, this.onStatTimer.bind(this));
        this.statTimer.start();
        this.app.use(bodyParser.json({
            limit: '500mb'
        }));
        this.app.get('/stats', this._stats.bind(this));
        this.app.get('/shell', this._shell.bind(this));
        this.app.post('/fileinfo', this.fileinfoRequest.bind(this));
        this.app.post('/exec', this.exec.bind(this));
        this.app.post('/execMulti', this.execMulti.bind(this));
        this.app.get('/download', this.download.bind(this));
        this.app.get('/sftpReaddir', this.sftpReaddir.bind(this));
        this.app.post('/upload', this.upload.bind(this));
        this.app.post('/checkLogin', this.checkLogin.bind(this));
        this.app.post('/checkLogins', this.checkLogins.bind(this));
        this.app.post('/razCache', this._razCache.bind(this));
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
        let connection;
        this.getConnection(sshOptions)
            .then((result) => {
            connection = result;
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
        })
            .finally(() => {
            this.releaseSshConnection(connection);
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
        this.getStats()
            .then((result) => {
            res.json(result);
        })
            .catch((err) => {
            next(err);
        });
    }
    _razCache(req, res, next) {
        this.razCache()
            .then((result) => {
            res.json(result);
        })
            .catch((err) => {
            next(err);
        });
    }
    upload(req, res, next) {
        let params = {};
        let isPartialUpload;
        var onBeforeSaveFile = (fields, opt, filename) => {
            try {
                for (let k in fields) {
                    params[k] = fields[k].val;
                }
                params = utils.parseParams(params, {
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
                    },
                    start: {
                        default: null,
                        type: 'integer'
                    }
                });
                isPartialUpload = (params.start !== null);
                if (isPartialUpload)
                    params.overwrite = true;
                this.logger.info('Upload filename=' + filename + ' . ' + params.path + '@' + params.host + ' , overwrite = ' + params.overwrite + ', start=' + params.start);
                return Promise.resolve(opt);
            }
            catch (err) {
                return Promise.reject(err);
            }
        };
        let uploadedFile = null;
        let opt = {};
        return HttpTools_1.HttpTools.saveUploadedFile(req, res, next, {
            onBeforeSaveFile: onBeforeSaveFile
        })
            .then((result) => {
            if (isPartialUpload)
                opt.start = params.start;
            uploadedFile = result.files[0];
            this.logger.info('Upload success [' + uploadedFile.name + ']');
            if (!params.overwrite && !isPartialUpload) {
                return this.remoteFileExists(params.host, params.username, params.password, params.key, params.passphrase, params.path, params.port);
            }
            else {
                return Promise.resolve(null);
            }
        })
            .then((fileExists = null) => {
            if (fileExists === true) {
                throw new Errors.BadRequest('File already exists: ' + params.path + ' (use \'overwrite\' option)', 400);
            }
            return this.scpSend(params.host, params.username, params.password, params.key, params.passphrase, uploadedFile.path, params.path, params.port, opt);
        })
            .then((result) => {
            this.logger.info('scpSend OK : ' + params.path + '@' + params.host);
            if (isPartialUpload)
                res.set('x-start-position', params.start);
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
            if (uploadedFile) {
                this.removeTempFileSync(uploadedFile.path);
            }
        })
            .catch((err) => {
            next(err);
        });
    }
    fileinfo(opt) {
        let params = utils.parseParams(opt, {
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
        let cmd = 'ls -ltFLd --time-style="+%Y-%m-%d %H:%M:%S" "' + params.path + '"';
        return this._exec({
            host: params.host,
            username: params.username,
            password: params.password,
            key: params.key,
            passphrase: params.passphrase,
            script: cmd,
            port: params.port,
            logError: true,
            pty: false,
            useCachedConnection: true
        })
            .then((result) => {
            let r;
            if (result.exitCode === 0) {
                result.stdout = result.stdout.trim();
                if (result.stdout === '') {
                    let sshError = new SshError_1.default("fileinfo: la commande ls n'a pas renvoyé de résultat");
                    sshError.connected = true;
                    throw sshError;
                }
                r = this.getFileObjectFromLsLineResult(result.stdout);
            }
            else {
                let errorMessage = result.stder;
                if (result.stderr.toLowerCase().contains("permission")) {
                    errorMessage = "Permission error : " + errorMessage;
                }
                let sshError = new SshError_1.default(errorMessage);
                sshError.connected = true;
                throw sshError;
            }
            return r;
        });
    }
    getFileObjectFromLsLineResult(line, regexp = null) {
        let file = {};
        line = line.replace(/\s+/, ' ');
        let fields = line.split(' ');
        file.date = fields[5] + " " + fields[6];
        file.name = line.rightOf(file.date + " ");
        if (regexp) {
            if (typeof regexp === 'string')
                regexp = new RegExp(regexp);
        }
        if (!regexp || file.name.match(regexp)) {
            file.rights = fields[0];
            file.type = file.rights[0];
            file.isFile = false;
            file.isLink = false;
            file.isDir = false;
            if (file.type == "d") {
                file.isDir = true;
            }
            else if (file.type == "l") {
                file.isLink = true;
            }
            else {
                file.isFile = true;
            }
            file.owner = fields[2];
            file.group = fields[3];
            file.size = fields[4];
            if (file.name.endsWith('/')) {
                file.name = file.name.substring(0, file.name.length - 1);
            }
            if (file.name.endsWith("*")) {
                file.name = file.name.substring(0, file.name.length - 1);
                file.executable = true;
            }
            else {
                file.executable = false;
            }
        }
        return file;
    }
    remoteFileExists(host, username, password, key, passphrase, remotePath, port) {
        let filename = p.basename(remotePath);
        let rep = p.dirname(remotePath);
        let script = `cd ${rep}
		if [ $? -ne 0 ]; then
		exit 99
		fi
		ls "${filename}"
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
            },
            start: {
                default: null,
                type: 'integer'
            },
            end: {
                default: null,
                type: 'integer'
            }
        });
        this.logger.info('ssh download remotePath=' + params.path + ' on ' + params.host + ':' + params.port + ', compress=' + params.compress + ", start=" + params.start + ", end=" + params.end);
        let filename = Files_1.Files.getFileName(params.path);
        let isPartialDownload = (params.start !== null) && (params.end !== null);
        if (isPartialDownload) {
            let opt = {
                start: params.start,
                end: params.end,
            };
            let connection;
            this.getConnection({
                host: params.host,
                username: params.username,
                password: params.password,
                key: params.key,
                passphrase: params.passphrase,
                port: params.port
            }, { useCache: true })
                .then((result) => {
                connection = result;
                return connection.scpGet(null, params.path, opt);
            })
                .then((readStream) => {
                let headerSent = false;
                res.set('x-start-position', params.start);
                res.set('x-end-position', params.end);
                readStream.on('data', (data) => {
                    if (!headerSent) {
                        if (params.compress)
                            res.attachment(filename + '.gz');
                        else
                            res.attachment(filename);
                        headerSent = true;
                    }
                });
                readStream.on('error', (err) => {
                    let sftpError = new SftpError_1.default(err);
                    sftpError.connected = true;
                    next(sftpError);
                });
                if (params.compress) {
                    let compressor = gzip.createGzip();
                    readStream.pipe(compressor).pipe(res);
                }
                else {
                    readStream.pipe(res);
                }
            })
                .finally(() => {
                this.releaseSshConnection(connection);
            });
        }
        else {
            let localdir = this.tmpDir + '/' + Math.random();
            let localPath = localdir + '/' + filename;
            fs.ensureDirSync(localdir);
            this.scpGet(params.host, params.username, params.password, params.key, params.passphrase, localPath, params.path, params.port)
                .then((result) => {
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
                            next(new Errors.HttpError(err.toString()));
                        }
                    });
                }
            })
                .catch(err => {
                next(err);
            });
        }
    }
    fileinfoRequest(req, res, next) {
        this.fileinfo(req.body)
            .then((result) => {
            res.status(200).json(result);
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
            },
            useCachedConnection: {
                type: 'boolean',
                default: true
            }
        });
        this._exec(params)
            .then((result) => {
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
        let connection;
        this.getConnection(params)
            .then((result) => {
            connection = result;
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
        })
            .finally(() => {
            this.releaseSshConnection(connection);
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
        let connection;
        return this.getConnection(params)
            .then((result) => {
            connection = result;
            return { result: true, params: params, error: null };
        })
            .catch((err) => {
            if (err.level === 'client-authentication') {
                return { result: false, params: params, error: err };
            }
            else {
                throw err;
            }
        })
            .finally(() => {
            this.releaseSshConnection(connection);
        });
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
        let connection;
        this.getConnection(params)
            .then((result) => {
            connection = result;
            let conn = connection.conn;
            conn.shell((err, stream) => {
                if (err) {
                    next(err);
                }
                else {
                    stream.on('close', function () {
                        this.releaseSshConnection(connection);
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
                }
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
            passphrase: null,
            useCachedConnection: true
        };
        Object.keys(defaultOpt).forEach(key => {
            if (typeof opt[key] === 'undefined') {
                opt[key] = defaultOpt[key];
            }
        });
        let connection;
        let start = new Date().getTime();
        this.logger.info("EXEC script on " + opt.host + ", username:" + opt.username);
        return this.getConnection({
            host: opt.host,
            port: opt.port,
            username: opt.username,
            password: opt.password,
            key: opt.key,
            passphrase: opt.passphrase
        }, { useCache: opt.useCachedConnection })
            .then((result) => {
            connection = result;
            return connection.exec(opt);
        })
            .then((result) => {
            let executionTime = new Date().getTime() - start;
            this.logger.info(connection.toString() + ' : Succès exec ssh (' + executionTime + ' ms)');
            return result;
        })
            .finally(() => {
            this.releaseSshConnection(connection);
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
        }, { useCache: true })
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
            this.releaseSshConnection(connection);
        });
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
        }, { useCache: true })
            .then((result) => {
            connection = result;
            return connection.scpSend(localPath, remotePath, opt);
        })
            .finally(() => {
            this.releaseSshConnection(connection);
        });
    }
    scpGet(host, username, password, key, passphrase, localPath, remotePath, port, opt = {}) {
        let connection;
        return this.getConnection({
            host: host,
            username: username,
            password: password,
            key: key,
            passphrase: passphrase,
            port: port
        }, { useCache: true })
            .then((result) => {
            connection = result;
            return connection.scpGet(localPath, remotePath, opt);
        })
            .finally(() => {
            this.releaseSshConnection(connection);
        });
    }
    getConnection(params, options = null) {
        try {
            this.currentRequestsCount++;
            SshConnection_1.default.stats.totalRequestsCount++;
            if (!params.port)
                params.port = this.defaultPort;
            let opt = {
                useCache: true
            };
            if (options) {
                Object.keys(options).forEach((k) => {
                    opt[k] = options[k];
                });
            }
            if (opt.useCache) {
                let poolId = SshConnection_1.default.calcPoolId(params);
                let pool = this.getConnectionPool(poolId, params);
                let connection;
                return pool.acquire()
                    .then((result) => {
                    connection = result;
                    SshConnection_1.default.stats.acquiredCount++;
                    if (!connection.isConnected()) {
                        return connection.connect();
                    }
                    else {
                        this.connectCacheHits++;
                        return connection;
                    }
                })
                    .catch((err) => {
                    this.releaseSshConnection(connection);
                    if (!(err instanceof SshError_1.default)) {
                        let message = 'Cannot acquire ssh connection on pool ' + poolId + ': ' + err.toString() + ' (host: ' + os.hostname() + ', worker: ' + process.pid + ')';
                        throw new Error(message);
                    }
                    else {
                        throw err;
                    }
                });
            }
            else {
                let connection = new SshConnection_1.default(params, {
                    logger: this.logger,
                    sshKeysDir: this.sshKeysDir,
                    connectTimeout: this.connectTimeout
                });
                connection.isInCache = false;
                return connection.connect();
            }
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    getConnectionPool(poolId, params) {
        if (this.pools.has(poolId)) {
            this.poolCacheHits++;
            return this.pools.get(poolId);
        }
        else {
            let start = new Date().getTime();
            this.logger.info("Creating ssh pool '" + poolId + "' (max size: " + this.poolsOptions.max + ')');
            let factory = {
                create: () => {
                    let connection = new SshConnection_1.default(params, {
                        poolId: poolId,
                        logger: this.logger,
                        sshKeysDir: this.sshKeysDir,
                        connectTimeout: this.connectTimeout
                    });
                    this.pooledConnections.set(poolId + "_" + connection.id, connection);
                    connection.isInCache = true;
                    return connection;
                },
                destroy: (connection) => {
                    if (connection.destroy) {
                        connection.destroy();
                        this.pooledConnections.delete(connection.id);
                    }
                    return Promise.resolve(connection);
                }
            };
            let pool = genericPool.createPool(factory, this.poolsOptions);
            this.pools.set(poolId, pool);
            this.createdPools++;
            let ellapsed = new Date().getTime() - start;
            this.logger.info("Pool created in " + ellapsed + ' ms');
            return pool;
        }
    }
    releaseSshConnection(connection) {
        if (!connection)
            return;
        if (connection.isInCache) {
            if (this.pools.has(connection.poolId)) {
                let pool = this.pools.get(connection.poolId);
                if (pool.isBorrowedResource(connection)) {
                    pool.release(connection)
                        .then(() => {
                        SshConnection_1.default.stats.releasedCount++;
                    });
                }
            }
        }
        else {
            connection.destroy();
        }
    }
}
exports.Tplugin = Tplugin;
//# sourceMappingURL=Tplugin.js.map