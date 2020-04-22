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
const utils = require("../../utils");
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
        this.isInCache = false;
        this.logger = options.logger;
        this.sshKeysDir = options.sshKeysDir;
        this.connectTimeout = options.connectTimeout;
        this.connectionParams = connectionParams;
        this.id = this.calcId(connectionParams);
        if (!options.poolId)
            this.poolId = SshConnection.calcPoolId(connectionParams);
        else
            this.poolId = options.poolId;
        SshConnection.stats.createdCount++;
        this.logger.info(this.toString() + " : ssh connection created");
    }
    static initStats() {
        SshConnection.stats = {
            createdCount: 0,
            destroyedCount: 0,
            acquiredCount: 0,
            releasedCount: 0,
            totalRequestsCount: 0,
            poolCacheHitsRatioPercent: null,
            connectCacheHitsRatioPercent: null,
            reqRatePerSec: null
        };
    }
    toString() {
        return this.connectionParams.username + "@" + this.connectionParams.host;
    }
    calcId(params) {
        return this.connectionParams.username + '@' + this.connectionParams.host + ":" + this.connectionParams.port + "_" + Math.random() * 10E6;
    }
    static calcPoolId(params) {
        let hash = utils.md5((params.password + params.key + params.passphrase).toString());
        let s = params.username + '@' + params.host + ":" + params.port + '_' + hash;
        return s;
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
        if (this.logger)
            this.logger.info(this.toString() + ' : Connection destroyed');
        SshConnection.stats.destroyedCount++;
    }
    onClosed() {
        if (this.conn) {
            this.conn.removeAllListeners();
            this.conn.destroy();
            this.conn = null;
            this.emit('end');
        }
    }
    close() {
        try {
            if (this.conn) {
                this.conn.end();
                this.conn.removeAllListeners();
                this.conn.destroy();
                this.conn = null;
            }
        }
        catch (err) {
            this.conn = null;
            this.logger.warn(this.toString() + ' : SshConnection.close(): ' + err.toString());
        }
    }
    isConnected() {
        return (this.conn !== null);
    }
    connect() {
        if (this.conn !== null) {
            return Promise.reject(new Error("Echec appel connect('" + this.connectionParams.username + "@" + this.connectionParams.host + "'): Déjà connecté"));
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
            sshOptions.passphrase = this.connectionParams.passphrase;
            if (SshConnection.cachedKeys.has(cacheKey)) {
                sshOptions.privateKey = SshConnection.cachedKeys.get(cacheKey);
                promise = this._connect(sshOptions)
                    .catch((err) => {
                    this.logger.warn(this.toString() + ': Use key cache error', err.toString().trim());
                    return this.findKeyConnection(sshOptions);
                });
            }
            else {
                promise = this.findKeyConnection(sshOptions);
            }
        }
        return promise.then((conn) => {
            this.conn = conn;
            conn.on('end', () => {
                this.logger.info(this.toString() + " : Connection end");
                this.onClosed();
            });
            conn.on('close', () => {
                this.logger.info(this.toString() + " : Connection closed");
                this.onClosed();
            });
            return this;
        });
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
                        let err = new SshError_1.default(error.toString(), level);
                        reject(err);
                    });
                }
                else {
                    let err = new SshError_1.default('No valid key found', 'client-authentication');
                    reject(err);
                }
            }
            else {
                let err = new SshError_1.default("SSH keys directory does not exists: '" + this.sshKeysDir + "'", 'client-authentication');
                reject(err);
            }
        });
    }
    getSshKeyCache(host, port) {
        return host + ':' + port;
    }
    _connect(sshOptions) {
        let start = new Date().getTime();
        let conn = this.getNewSshClient();
        sshOptions.keepaliveCountMax = 10;
        sshOptions.readyTimeout = this.connectTimeout;
        return new Promise((resolve, reject) => {
            let timeout = setTimeout(() => {
                let ellapsed = new Date().getTime() - start;
                let errorMessage = 'CONNECT TIMEOUT on after ' + ellapsed + ' ms. ';
                let err = new SshError_1.default(errorMessage, 'client-timeout');
                this.logger.error(this.toString() + ' : ' + errorMessage);
                try {
                    conn.end();
                }
                catch (err) {
                    this.logger.warn(this.toString() + ' : getConnection: conn.end(): ' + err.toString());
                }
                reject(err);
            }, this.connectTimeout + 5000);
            conn.on('error', (err) => {
                let ellapsed = new Date().getTime() - start;
                clearTimeout(timeout);
                try {
                    conn.end();
                }
                catch (err) {
                    this.logger.warn(this.toString() + ' : getConnection: conn.end(): ' + err.toString());
                }
                let errorMessage = 'CONNECT ERROR after ' + ellapsed + ' ms. level=' + err.level + ' ' + err.toString();
                this.logger.error(this.toString() + ' : ' + errorMessage);
                let level = 'connect-error';
                if ((typeof err === 'object') && err.level) {
                    level = err.level;
                }
                let sshError = new SshError_1.default(errorMessage, level);
                reject(sshError);
            });
            conn.on('ready', () => {
                let ellapsed = new Date().getTime() - start;
                this.validSshOptions = sshOptions;
                clearTimeout(timeout);
                this.logger.info(this.toString() + ' : CONNECT OK in ' + ellapsed + ' ms');
                resolve(conn);
            });
            try {
                conn.connect(sshOptions);
            }
            catch (err) {
                clearTimeout(timeout);
                let sshError;
                if (err.level) {
                    sshError = new SshError_1.default(err, err.level);
                }
                else {
                    sshError = new SshError_1.default(err, 'client-authentication');
                }
                reject(sshError);
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
        this.lastUse = new Date().getTime();
        return new Promise((resolve, reject) => {
            if (!this.isConnected()) {
                reject('Non connecté');
            }
            else {
                let onExec = (err, stream) => {
                    if (err) {
                        let errorMessage = 'exec : ' + err.toString();
                        this.logger.error(this.toString() + ' : ' + errorMessage);
                        let sshError = new SshError_1.default(errorMessage);
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
                                    err = new SshError_1.default('Process killed');
                                }
                                else {
                                    err = new SshError_1.default('SSH stream closed');
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
                            r.stderr += data;
                        });
                    }
                };
                let pty = (opt.pty === true);
                this.conn.exec(opt.script, { pty: pty }, onExec.bind(this));
            }
        });
    }
    scpSend(localPath, remotePath, opt = {}) {
        this.lastUse = new Date().getTime();
        return new Promise((resolve, reject) => {
            this.conn.sftp((err, sftp) => {
                if (err) {
                    let errorMessage = 'scpSend ' + localPath + ' -> ' + this.toString() + ":" + remotePath + ': ' + err.toString();
                    this.logger.error(errorMessage);
                    let sshError = new SshError_1.default(errorMessage);
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
        this.lastUse = new Date().getTime();
        return new Promise((resolve, reject) => {
            this.conn.sftp((err, sftp) => {
                if (err) {
                    let errorMessage = 'scpGet ' + remotePath + ' -> ' + this.toString() + ":" + localPath + ': ' + err.toString();
                    this.logger.error(errorMessage);
                    let sshError = new SshError_1.default(errorMessage);
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
        this.lastUse = new Date().getTime();
        return new Promise((resolve, reject) => {
            this.conn.sftp((err, sftp) => {
                if (err) {
                    let errorMessage = 'sftpReaddir : ' + err.toString();
                    this.logger.error(this.toString() + ' : ' + errorMessage);
                    let sshError = new SshError_1.default(errorMessage);
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
SshConnection.initStats();
//# sourceMappingURL=SshConnection.js.map