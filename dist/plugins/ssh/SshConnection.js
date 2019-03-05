"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SshError_1 = require("./SshError");
const fs = require("fs-extra");
const Ssh2 = require("ssh2");
const Promise = require("bluebird");
const EventEmitter = require("events");
class SshConnection extends EventEmitter {
    constructor(config) {
        super();
        this.sshKeysDir = null;
        this.defaultPort = 22;
        this.connectTimeout = 10000;
        this.logger = null;
        this.conn = null;
        this.logger = config.logger;
        this.sshKeysDir = config.sshKeysDir;
        this.defaultPort = config.defaultPort;
        this.connectTimeout = config.connectTimeout;
    }
    getNewSshClient() {
        return new Ssh2.Client();
    }
    close() {
        if (this.conn) {
            try {
                this.conn.end();
                this.conn = null;
            }
            catch (err) {
                this.logger.warn('SshConnection.close(): ' + err.toString());
            }
        }
    }
    connect(params) {
        if (this.conn !== null)
            this.close();
        let tryPassword = ((typeof params.password !== 'undefined') && (params.password !== null));
        let tryKey = ((typeof params.key !== 'undefined') && (params.key !== null)) && !tryPassword;
        let tryAgentKey = !tryPassword && !tryKey;
        let promise;
        if (tryPassword) {
            promise = this._connect({
                host: params.host,
                port: params.port,
                username: params.username,
                password: params.password
            });
        }
        else if (tryKey) {
            promise = this._connect({
                host: params.host,
                port: params.port,
                username: params.username,
                privateKey: params.key,
                passphrase: params.passphrase
            });
        }
        else if (tryAgentKey) {
            let cacheKey = this.getSshKeyCache(params.host, params.port);
            if (SshConnection.cachedKeys.has(cacheKey)) {
                let key = SshConnection.cachedKeys.get(cacheKey);
                promise = this._connect({
                    host: params.host,
                    port: params.port,
                    username: params.username,
                    privateKey: key,
                    passphrase: params.passphrase
                })
                    .catch((err) => {
                    this.logger.warn('Use key cache error', err.toString().trim());
                    return this.findKeyConnection(params.host, params.port, params.username, params.passphrase);
                });
            }
            else {
                promise = this.findKeyConnection(params.host, params.port, params.username, params.passphrase);
            }
        }
        return promise.then((conn) => {
            this.conn = conn;
            return conn;
        });
    }
    findKeyConnection(host, port, username, passphrase) {
        return new Promise((resolve, reject) => {
            if (fs.existsSync(this.sshKeysDir)) {
                let promises = [];
                let files = fs.readdirSync(this.sshKeysDir);
                for (let f of files) {
                    let keyPath = this.sshKeysDir + '/' + f;
                    if (fs.statSync(keyPath).isFile()) {
                        promises.push(this.getKeyConnection(host, port, username, keyPath, passphrase));
                    }
                }
                if (promises.length > 0) {
                    Promise.any(promises)
                        .then((conn) => {
                        resolve(conn);
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
    _connect(params) {
        let conn = this.getNewSshClient();
        params.keepaliveCountMax = 10;
        params.readyTimeout = this.connectTimeout;
        return new Promise((resolve, reject) => {
            let timeout = setTimeout(() => {
                let err = new SshError_1.SshError('connect timeout on ' + params.host + ':' + params.port + ' after ' + (this.connectTimeout + 5000) + ' ms', 'client-timeout');
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
                this.logger.error(params.username + '@' + params.host + ': CONNECT ERROR.', 'level=' + err.level + ' ' + err.toString());
                let level = 'connect-error';
                if ((typeof err === 'object') && err.level) {
                    level = err.level;
                }
                let sshError = new SshError_1.SshError(err, level);
                reject(sshError);
            });
            conn.on('ready', () => {
                clearTimeout(timeout);
                this.logger.info(params.username + '@' + params.host + ': CONNECT OK');
                resolve(conn);
            });
            try {
                conn.connect(params);
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
    getKeyConnection(host, port, username, keyPath, passphrase) {
        let key = require('fs').readFileSync(keyPath);
        return this._connect({
            host: host,
            port: port,
            username: username,
            privateKey: key,
            passphrase: passphrase
        })
            .then(conn => {
            let cacheKey = this.getSshKeyCache(host, port);
            SshConnection.cachedKeys.set(cacheKey, key);
            return conn;
        });
    }
}
SshConnection.cachedKeys = new Map();
exports.default = SshConnection;
//# sourceMappingURL=SshConnection.js.map