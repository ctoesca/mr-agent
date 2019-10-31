"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SshError_1 = require("./SshError");
const fs = require("fs-extra");
const Ssh2 = require("ssh2");
const Promise = require("bluebird");
const EventEmitter = require("events");
require("../../utils/StringTools");
const SftpError_1 = require("./SftpError");
const HttpAgent_1 = require("./HttpAgent");
const HttpsAgent_1 = require("./HttpsAgent");
class SshConnection extends EventEmitter {
    constructor(connectionParams, options) {
        super();
        this.conn = null;
        this.sshKeysDir = null;
        this.connectTimeout = 10000;
        this.logger = null;
        this.connectionParams = null;
        this.lastUse = new Date().getTime();
        this.id = null;
        this.httpsAgent = null;
        this.httpAgent = null;
        this.validSshOptions = null;
        this.logger = options.logger;
        this.sshKeysDir = options.sshKeysDir;
        this.connectTimeout = options.connectTimeout;
        this.connectionParams = connectionParams;
        this.id = SshConnection.calcId(connectionParams);
    }
    toString() {
        return this.connectionParams.username + "@" + this.connectionParams.host;
    }
    static calcId(params) {
        let s = params.host + "_" + params.port + "_" + params.username + "_" + params.password + "_" + params.key + "_" + params.passphrase;
        return s.hashCode().toString();
    }
    getHttpAgent(https = false) {
        if (https) {
            if (!this.httpsAgent) {
                this.httpsAgent = new HttpsAgent_1.default(this.validSshOptions);
            }
            return this.httpsAgent;
        }
        else {
            if (!this.httpAgent) {
                this.httpAgent = new HttpAgent_1.default(this.validSshOptions);
            }
            return this.httpAgent;
        }
    }
    getNewSshClient() {
        return new Ssh2.Client();
    }
    destroy() {
        this.close();
        if (this.httpAgent)
            this.httpAgent.destroy();
        if (this.httpsAgent)
            this.httpsAgent.destroy();
        this.removeAllListeners();
    }
    close() {
        try {
            if (this.conn) {
                this.conn.end();
                this.conn = null;
            }
            this.connectPromise = null;
        }
        catch (err) {
            this.logger.warn('SshConnection.close(): ' + err.toString());
        }
    }
    isConnected() {
        return (this.conn !== null);
    }
    connect() {
        if (this.connectPromise)
            return this.connectPromise;
        if (this.conn !== null) {
            this.close();
        }
        let tryPassword = ((typeof this.connectionParams.password !== 'undefined') && (this.connectionParams.password !== '') && (this.connectionParams.password !== null));
        let tryKey = ((typeof this.connectionParams.key !== 'undefined') && (this.connectionParams.key !== '') && (this.connectionParams.key !== null)) && !tryPassword;
        let tryAgentKey = !tryPassword && !tryKey;
        let promise;
        let sshOptions = {
            host: this.connectionParams.host,
            port: this.connectionParams.port,
            username: this.connectionParams.username,
        };
        if (tryPassword) {
            sshOptions.password = this.connectionParams.password;
            promise = this._connect(sshOptions);
        }
        else if (tryKey) {
            sshOptions.privateKey = this.connectionParams.key;
            sshOptions.passphrase = this.connectionParams.passphrase;
            promise = this._connect(sshOptions);
        }
        else if (tryAgentKey) {
            let cacheKey = this.getSshKeyCache(sshOptions.host, sshOptions.port);
            if (SshConnection.cachedKeys.has(cacheKey)) {
                let key = SshConnection.cachedKeys.get(cacheKey);
                sshOptions.privateKey = key;
                sshOptions.passphrase = this.connectionParams.passphrase;
                promise = this._connect(sshOptions)
                    .catch((err) => {
                    this.logger.warn('Use key cache error', err.toString().trim());
                    return this.findKeyConnection(sshOptions);
                });
            }
            else {
                promise = this.findKeyConnection(sshOptions);
            }
        }
        this.connectPromise = promise.then((conn) => {
            this.conn = conn;
            this.connectPromise = null;
            conn.on('end', () => {
                this.conn = null;
                this.emit('end');
            });
            return conn;
        })
            .catch((err) => {
            this.connectPromise = null;
            throw err;
        });
        return this.connectPromise;
    }
    findKeyConnection(sshOptions) {
        return new Promise((resolve, reject) => {
            if (fs.existsSync(this.sshKeysDir)) {
                let promises = [];
                let files = fs.readdirSync(this.sshKeysDir);
                for (let f of files) {
                    let keyPath = this.sshKeysDir + '/' + f;
                    if (fs.statSync(keyPath).isFile()) {
                        promises.push(this.getKeyConnection(sshOptions, keyPath));
                    }
                }
                if (promises.length > 0) {
                    Promise.any(promises)
                        .then((result) => {
                        resolve(result);
                    })
                        .catch((error) => {
                        let level = error.level;
                        if (error instanceof Promise.AggregateError) {
                            error = error[0];
                            level = error.level;
                            if (error.length > 1) {
                                for (let i = 0; i < error.length; i++) {
                                    if ((error[i].level === 'client-socket') || (error[i].level === 'client-timeout')) {
                                        error = error[i];
                                        level = error.level;
                                        break;
                                    }
                                }
                            }
                        }
                        let err = new SshError_1.SshError(error.toString(), level);
                        reject(err);
                    });
                }
                else {
                    let err = new SshError_1.SshError('No valid key found', 'client-authentication');
                    reject(err);
                }
            }
            else {
                let err = new SshError_1.SshError("SSH keys directory does not exists: '" + this.sshKeysDir + "'", 'client-authentication');
                reject(err);
            }
        });
    }
    getSshKeyCache(host, port) {
        return host + ':' + port;
    }
    _connect(sshOptions) {
        let conn = this.getNewSshClient();
        sshOptions.keepaliveCountMax = 10;
        sshOptions.readyTimeout = this.connectTimeout;
        return new Promise((resolve, reject) => {
            let timeout = setTimeout(() => {
                let err = new SshError_1.SshError('connect timeout on ' + sshOptions.host + ':' + sshOptions.port + ' after ' + (this.connectTimeout + 5000) + ' ms', 'client-timeout');
                try {
                    conn.end();
                }
                catch (err) {
                    this.logger.warn('getConnection: conn.end(): ' + err.toString());
                }
                reject(err);
            }, this.connectTimeout + 5000);
            conn.on('error', (err) => {
                clearTimeout(timeout);
                this.logger.error(sshOptions.username + '@' + sshOptions.host + ': CONNECT ERROR.', 'level=' + err.level + ' ' + err.toString());
                let level = 'connect-error';
                if ((typeof err === 'object') && err.level) {
                    level = err.level;
                }
                let sshError = new SshError_1.SshError(err, level);
                reject(sshError);
            });
            conn.on('ready', () => {
                this.validSshOptions = sshOptions;
                clearTimeout(timeout);
                this.logger.info(sshOptions.username + '@' + sshOptions.host + ': CONNECT OK');
                resolve(conn);
            });
            try {
                conn.connect(sshOptions);
            }
            catch (err) {
                clearTimeout(timeout);
                let sshError;
                if (err.level) {
                    sshError = new SshError_1.SshError(err, err.level);
                }
                else {
                    sshError = new SshError_1.SshError(err, 'client-authentication');
                }
                throw sshError;
            }
        });
    }
    getKeyConnection(sshOptions, keyPath) {
        let key = require('fs').readFileSync(keyPath);
        sshOptions.privateKey = key;
        return this._connect(sshOptions)
            .then(conn => {
            let cacheKey = this.getSshKeyCache(sshOptions.host, sshOptions.port);
            SshConnection.cachedKeys.set(cacheKey, key);
            return conn;
        });
    }
    exec(opt) {
        let r = {
            host: opt.host,
            stdout: '',
            stderr: '',
            exitCode: null,
            isKilled: false
        };
        return new Promise((resolve, reject) => {
            if (!this.isConnected()) {
                reject('Non connecté');
            }
            else {
                let onExec = (err, stream) => {
                    if (err) {
                        let sshError = new SshError_1.SshError(this.connectionParams.username + '@' + this.connectionParams.host + ' exec : ' + err.toString());
                        sshError.connected = true;
                        this.close();
                        reject(sshError);
                    }
                    else {
                        stream.on('exit', (code, signal) => {
                            if ((signal === 'SIGTERM') || (signal == 'SIGKILL')) {
                                r.isKilled = true;
                            }
                            if (code != null) {
                                r.exitCode = code;
                            }
                            stream.close();
                        });
                        stream.on('close', (exitCode) => {
                            if ((typeof exitCode != 'undefined') && (exitCode !== null)) {
                                r.exitCode = exitCode;
                            }
                            if (r.exitCode === null) {
                                let err;
                                if (r.isKilled) {
                                    err = new SshError_1.SshError('Process killed');
                                }
                                else {
                                    err = new SshError_1.SshError('SSH stream closed');
                                }
                                err.connected = true;
                                reject(err);
                            }
                            else {
                                resolve(r);
                            }
                        });
                        stream.on('data', (data) => {
                            r.stdout += data;
                        });
                        stream.stderr.on('data', (data) => {
                            this.logger.debug('ONDATA');
                            r.stderr += data;
                        });
                    }
                };
                if (opt.pty) {
                    this.conn.exec(opt.script, { pty: true }, onExec.bind(this));
                }
                else {
                    this.conn.exec(opt.script, onExec.bind(this));
                }
            }
        });
    }
    scpSend(localPath, remotePath, opt = {}) {
        return new Promise((resolve, reject) => {
            this.conn.sftp((err, sftp) => {
                if (err) {
                    let sshError = new SshError_1.SshError(this.connectionParams.username + '@' + this.connectionParams.host + ' scpSend : ' + err.toString());
                    sshError.connected = true;
                    reject(sshError);
                    this.close();
                }
                else {
                    sftp.fastPut(localPath, remotePath, (err2) => {
                        if (err2) {
                            let sshError = new SftpError_1.default(err2);
                            sshError.connected = true;
                            reject(sshError);
                        }
                        else {
                            resolve({
                                host: this.connectionParams.host,
                                port: this.connectionParams.port,
                                username: this.connectionParams.username,
                                remotePath: remotePath,
                                localPath: localPath
                            });
                        }
                    });
                }
            });
        });
    }
    scpGet(localPath, remotePath) {
        return new Promise((resolve, reject) => {
            this.conn.sftp((err, sftp) => {
                if (err) {
                    let sshError = new SshError_1.SshError(this.connectionParams.username + '@' + this.connectionParams.host + ' scpGet : ' + err.toString());
                    sshError.connected = true;
                    reject(sshError);
                    this.close();
                }
                else {
                    sftp.fastGet(remotePath, localPath, (err2) => {
                        if (err2) {
                            let sftpError = new SftpError_1.default(err2);
                            reject(sftpError);
                        }
                        else {
                            resolve({
                                host: this.connectionParams.host,
                                port: this.connectionParams.port,
                                username: this.connectionParams.username,
                                remotePath: remotePath,
                                localPath: localPath
                            });
                        }
                    });
                }
            });
        });
    }
    sftpReaddir(path) {
        return new Promise((resolve, reject) => {
            this.conn.sftp((err, sftp) => {
                if (err) {
                    let sshError = new SshError_1.SshError(this.connectionParams.username + '@' + this.connectionParams.host + ' sftpReaddir : ' + err.toString());
                    sshError.connected = true;
                    reject(sshError);
                    this.close();
                }
                else {
                    sftp.readdir(path, (err2, r) => {
                        if (err2) {
                            let sftpError = new SftpError_1.default(err2);
                            sftpError.connected = true;
                            reject(sftpError);
                        }
                        else {
                            resolve({
                                result: r,
                                host: this.connectionParams.host,
                                port: this.connectionParams.port,
                                username: this.connectionParams.username,
                                path: path
                            });
                        }
                    });
                }
            });
        });
    }
}
exports.default = SshConnection;
SshConnection.cachedKeys = new Map();
//# sourceMappingURL=SshConnection.js.map