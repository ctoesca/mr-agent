"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ThttpPlugin_1 = require("../ThttpPlugin");
const SshError_1 = require("./SshError");
const WorkerApplication_1 = require("../../WorkerApplication");
const Files_1 = require("../../utils/Files");
const HttpTools_1 = require("../../utils/HttpTools");
const fs = require("fs-extra");
const p = require("path");
const Errors = require("../../Errors");
const Promise = require("bluebird");
const SftpError_1 = require("./SftpError");
const SshConnection_1 = require("./SshConnection");
const bodyParser = require("body-parser");
class Tplugin extends ThttpPlugin_1.ThttpPlugin {
    constructor(application, config) {
        super(application, config);
        this.sshKeysDir = null;
        this.defaultPort = 22;
        this.connectTimeout = 10000;
        if (this.config.sshKeysDir) {
            this.sshKeysDir = this.config.sshKeysDir;
        }
        else {
            this.sshKeysDir = WorkerApplication_1.WorkerApplication.getConfigDir() + '/sshKeys';
        }
    }
    install() {
        super.install();
        this.app.use(bodyParser.json({
            limit: '500mb'
        }));
        this.app.post('/exec', this.exec.bind(this));
        this.app.post('/execMulti', this.execMulti.bind(this));
        this.app.get('/download', this.download.bind(this));
        this.app.post('/upload', this.upload.bind(this));
        this.app.post('/checkLogin', this.checkLogin.bind(this));
        this.app.post('/checkLogins', this.checkLogins.bind(this));
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
    getConnection(params, options = null) {
        try {
            let opt = {
                closeConnection: false
            };
            if (options) {
                Object.keys(options).forEach((k) => {
                    opt[k] = options[k];
                });
            }
            let c = new SshConnection_1.default({
                logger: this.logger,
                sshKeysDir: this.sshKeysDir,
                defaultPort: this.defaultPort,
                connectTimeout: this.connectTimeout
            });
            return c.connect(params)
                .then((conn) => {
                if (opt.closeConnection) {
                    c.close();
                }
                return c;
            });
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    _exec(opt, sshConnection = null) {
        let connPromise;
        if (sshConnection === null) {
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
            connPromise = this.getConnection({
                host: opt.host,
                port: opt.port,
                username: opt.username,
                password: opt.password,
                key: opt.key,
                passphrase: opt.passphrase
            });
        }
        else {
            connPromise = Promise.resolve(sshConnection);
        }
        let r = {
            host: opt.host,
            stdout: '',
            stderr: '',
            exitCode: null,
            isKilled: false
        };
        let promiseFinished = false;
        return connPromise
            .then((connection) => {
            return new Promise((resolve, reject) => {
                let conn = connection.conn;
                conn.on('end', () => {
                    if (!promiseFinished) {
                        if (r.exitCode === null) {
                            let err;
                            if (r.isKilled) {
                                err = new SshError_1.SshError('Process killed');
                            }
                            else {
                                err = new SshError_1.SshError('SSH connection closed');
                            }
                            err.connected = true;
                            reject(err);
                        }
                        else {
                            resolve(r);
                        }
                    }
                    promiseFinished = true;
                });
                function onExec(err, stream) {
                    if (err) {
                        this.logger.error(err);
                        promiseFinished = true;
                        let sshError = new SshError_1.SshError(err.toString());
                        sshError.connected = true;
                        reject(sshError);
                    }
                    else {
                        stream.on('exit', (code, signal) => {
                            if (signal === 'SIGTERM') {
                                r.isKilled = true;
                            }
                            if (code !== null) {
                                r.exitCode = code;
                            }
                        });
                        stream.on('close', (exitCode) => {
                            if (exitCode !== null) {
                                r.exitCode = exitCode;
                            }
                            conn.end();
                        });
                        stream.on('data', (data) => {
                            r.stdout += data;
                        });
                        stream.stderr.on('data', (data) => {
                            this.logger.debug('ONDATA');
                            r.stderr += data;
                        });
                    }
                }
                if (opt.pty) {
                    conn.exec(opt.script, { pty: true }, onExec.bind(this));
                }
                else {
                    conn.exec(opt.script, onExec.bind(this));
                }
            });
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
    scpSend(host, username, password, key, passphrase, localPath, remotePath, port) {
        return this.getConnection({
            host: host,
            username: username,
            password: password,
            key: key,
            passphrase: passphrase,
            port: port
        })
            .then((result) => {
            return new Promise((resolve, reject) => {
                let conn = result.conn;
                conn.sftp((err, sftp) => {
                    if (err) {
                        let sshError = new SshError_1.SshError(err);
                        sshError.connected = true;
                        reject(sshError);
                    }
                    else {
                        sftp.fastPut(localPath, remotePath, (err2, r) => {
                            if (err2) {
                                reject(new SftpError_1.default(err2));
                            }
                            else {
                                resolve({
                                    host: host,
                                    port: port,
                                    username: username,
                                    remotePath: remotePath,
                                    localPath: localPath
                                });
                            }
                            conn.end();
                        });
                    }
                });
            });
        });
    }
    scpGet(host, username, password, key, passphrase, localPath, remotePath, port) {
        return this.getConnection({
            host: host,
            username: username,
            password: password,
            key: key,
            passphrase: passphrase,
            port: port
        })
            .then((result) => {
            return new Promise((resolve, reject) => {
                let conn = result.conn;
                conn.sftp((err, sftp) => {
                    if (err) {
                        let sshError = new SshError_1.SshError(err);
                        sshError.connected = true;
                        reject(sshError);
                    }
                    else {
                        sftp.fastGet(remotePath, localPath, (err2, r) => {
                            if (err2) {
                                let sftpError = new SftpError_1.default(err2);
                                reject(sftpError);
                            }
                            else {
                                resolve({
                                    host: host,
                                    port: port,
                                    username: username,
                                    remotePath: remotePath,
                                    localPath: localPath
                                });
                            }
                            conn.end();
                        });
                    }
                });
            });
        });
    }
}
exports.Tplugin = Tplugin;
//# sourceMappingURL=Tplugin.js.map