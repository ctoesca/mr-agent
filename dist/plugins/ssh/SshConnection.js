"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SshConnection = void 0;
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
        if (options.logger)
            this.logger = options.logger;
        else
            this.logger = app.getLogger('SshConnection');
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
    static clearCache() {
        SshConnection.allSshKeys = null;
        SshConnection.allSshKeysUpdateTime = null;
        SshConnection.cachedKeys.clear();
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
    connect(conn = null) {
        let promise;
        try {
            if (this.conn !== null) {
                return Promise.reject(new Error("Echec appel connect('" + this.connectionParams.username + "@" + this.connectionParams.host + "'): Déjà connecté"));
            }
            let tryPassword = ((typeof this.connectionParams.password !== 'undefined') && (this.connectionParams.password !== '') && (this.connectionParams.password !== null));
            let tryKey = ((typeof this.connectionParams.key !== 'undefined') && (this.connectionParams.key !== '') && (this.connectionParams.key !== null)) && !tryPassword;
            let tryAgentKey = !tryPassword && !tryKey;
            let sshOptions = {
                host: this.connectionParams.host,
                port: this.connectionParams.port,
                username: this.connectionParams.username,
                password: null,
                privateKey: null,
                passphrase: null
            };
            for (let k in this.connectionParams) {
                if (sshOptions[k] === undefined)
                    sshOptions[k] = this.connectionParams[k];
            }
            if (tryPassword) {
                sshOptions.password = this.connectionParams.password;
                promise = this._connect(sshOptions, conn);
            }
            else if (tryKey) {
                sshOptions.privateKey = this.connectionParams.key;
                sshOptions.passphrase = this.connectionParams.passphrase;
                promise = this._connect(sshOptions, conn);
            }
            else if (tryAgentKey) {
                let cacheKey = this.getSshKeyCache(sshOptions);
                sshOptions.passphrase = this.connectionParams.passphrase;
                if (SshConnection.cachedKeys.has(cacheKey)) {
                    sshOptions.privateKey = SshConnection.cachedKeys.get(cacheKey);
                    promise = this._connect(sshOptions, conn)
                        .catch((err) => {
                        this.logger.warn(this.toString() + ': Use key cache error', err.toString().trim());
                        return this.findKeyConnection(sshOptions, conn);
                    });
                }
                else {
                    promise = this.findKeyConnection(sshOptions, conn);
                }
            }
        }
        catch (err) {
            this.logger.error(err);
            let sshError = new SshError_1.default(err.toString(), 'connect-error');
            return Promise.reject(sshError);
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
    getAllKeys() {
        return new Promise((resolve, reject) => {
            let now = new Date().getTime();
            if ((SshConnection.allSshKeys === null) || ((now - SshConnection.allSshKeysUpdateTime) > SshConnection.allSshKeysTimeout)) {
                if (fs.existsSync(this.sshKeysDir)) {
                    try {
                        SshConnection.allSshKeys = [];
                        let files = fs.readdirSync(this.sshKeysDir);
                        for (let f of files) {
                            let keyPath = this.sshKeysDir + '/' + f;
                            if (fs.statSync(keyPath).isFile()) {
                                this.logger.info("Ssh key '" + keyPath + "' loaded in cache");
                                let key = fs.readFileSync(keyPath);
                                SshConnection.allSshKeys.push(key);
                            }
                        }
                        SshConnection.allSshKeysUpdateTime = now;
                        this.logger.info(SshConnection.allSshKeys.length + " ssh keys loaded in cache.");
                        resolve(SshConnection.allSshKeys);
                    }
                    catch (err) {
                        reject(new Error("Cannot read ssh keys: " + err.toString()));
                    }
                }
                else {
                    reject(new Error("SSH keys directory does not exists: '" + this.sshKeysDir + "'"));
                }
            }
            else {
                resolve(SshConnection.allSshKeys);
            }
        });
    }
    findKeyConnection(sshOptions, conn) {
        this.logger.info(this.toString() + " : findKeyConnection ...");
        return this.getAllKeys()
            .then((keys) => {
            return new Promise((resolve, reject) => {
                if (keys.length > 0) {
                    let keyFound = false;
                    let errors = [];
                    Promise.each(keys, (key, index, arrayLength) => {
                        if (!keyFound) {
                            return this.getKeyConnection(sshOptions, key, conn)
                                .then((result) => {
                                keyFound = true;
                                errors = [];
                                resolve(result);
                            })
                                .catch((err) => {
                                errors.push(err);
                            });
                        }
                        else {
                            return Promise.resolve();
                        }
                    })
                        .finally(() => {
                        if (!keyFound) {
                            let err = null;
                            if (errors.length > 1) {
                                for (let error of errors) {
                                    if ((error.level === 'client-socket') || (error.level === 'client-timeout')) {
                                        err = new SshError_1.default(error.toString(), error.level);
                                        break;
                                    }
                                }
                            }
                            else {
                                err = new SshError_1.default(errors[0].toString(), errors[0].level);
                            }
                            if (err === null)
                                err = new SshError_1.default('No valid key found', 'client-authentication');
                            reject(err);
                        }
                    });
                }
                else {
                    let err = new SshError_1.default('No key in sshKeys directory', 'client-authentication');
                    reject(err);
                }
            });
        })
            .catch((err) => {
            err = new SshError_1.default(err.toString(), 'client-authentication');
            throw err;
        });
    }
    getSshKeyCache(sshOptions) {
        return sshOptions.username + '@' + sshOptions.host + ':' + sshOptions.port;
    }
    _connect(sshOptions, conn = null) {
        let start = new Date().getTime();
        if (conn === null)
            conn = this.getNewSshClient();
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
    getKeyConnection(sshOptions, key, conn) {
        sshOptions.privateKey = key;
        return this._connect(sshOptions, conn)
            .then(conn => {
            let cacheKey = this.getSshKeyCache(sshOptions);
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
                    let errorMessage = 'scpSend ' + this.toString() + ": " + localPath + ' -> ' + this.toString() + ":" + remotePath + ': ' + err.toString();
                    this.logger.error(errorMessage);
                    let sshError = new SftpError_1.default(err);
                    sshError.connected = true;
                    reject(sshError);
                    this.close();
                }
                else {
                    let isPartialUpload = (typeof opt.start !== "undefined") && (opt.start !== null);
                    if (isPartialUpload) {
                        try {
                            let streamOpt = {
                                flags: 'r+',
                                start: opt.start
                            };
                            let stream = sftp.createWriteStream(remotePath, streamOpt);
                            let fileStream = fs.createReadStream(localPath);
                            stream.on('error', (err) => {
                                let sshError = new SftpError_1.default(err);
                                sshError.connected = true;
                                reject(sshError);
                                sftp.end();
                            });
                            fileStream.on('end', () => {
                                resolve({
                                    host: this.connectionParams.host,
                                    port: this.connectionParams.port,
                                    username: this.connectionParams.username,
                                    remotePath: remotePath,
                                    localPath: localPath
                                });
                                sftp.end();
                            });
                            fileStream.pipe(stream);
                        }
                        catch (err) {
                            reject(err);
                            sftp.end();
                        }
                    }
                    else {
                        sftp.fastPut(localPath, remotePath, (err2) => {
                            sftp.end();
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
                }
            });
        });
    }
    scpGet(localPath, remotePath, opt = {}) {
        this.lastUse = new Date().getTime();
        return new Promise((resolve, reject) => {
            this.conn.sftp((err, sftp) => {
                if (err) {
                    let errorMessage = 'scpGet ' + this.toString() + " " + remotePath + ' -> ' + this.toString() + ":" + localPath + ': ' + err.toString();
                    this.logger.error(errorMessage);
                    let sshError = new SftpError_1.default(err);
                    sshError.connected = true;
                    reject(sshError);
                    this.close();
                }
                else {
                    let isPartialDownload = (typeof opt.start !== "undefined") && (typeof opt.end !== "undefined") && (opt.start !== null) && (opt.end !== null);
                    if (isPartialDownload) {
                        try {
                            let stream = sftp.createReadStream(remotePath, {
                                start: opt.start,
                                end: opt.end
                            });
                            stream.on('end', () => {
                                sftp.end();
                            });
                            resolve(stream);
                        }
                        catch (err) {
                            reject(err);
                        }
                    }
                    else {
                        sftp.fastGet(remotePath, localPath, (err2) => {
                            sftp.end();
                            if (err2) {
                                let sftpError = new SftpError_1.default(err2);
                                sftpError.connected = true;
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
                }
            });
        });
    }
    sftpReaddir(path) {
        this.lastUse = new Date().getTime();
        return new Promise((resolve, reject) => {
            this.conn.sftp((err, sftp) => {
                if (err) {
                    let errorMessage = 'sftpReaddir : ' + err.toString() + ' ' + path;
                    this.logger.error(errorMessage);
                    let sshError = new SftpError_1.default(err);
                    sshError.connected = true;
                    reject(sshError);
                    this.close();
                }
                else {
                    sftp.readdir(path, (err2, r) => {
                        sftp.end();
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
exports.SshConnection = SshConnection;
SshConnection.cachedKeys = new Map();
SshConnection.allSshKeys = null;
SshConnection.allSshKeysUpdateTime = null;
SshConnection.allSshKeysTimeout = 1800 * 1000;
SshConnection.initStats();
//# sourceMappingURL=SshConnection.js.map