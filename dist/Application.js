"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils = require("./utils");
const path = require("path");
const EventEmitter = require("events");
const bunyan = require("bunyan");
const shell = require("shelljs");
const p = require("path");
class Application extends EventEmitter {
    constructor(configPath, opt = {}) {
        super();
        this.config = {};
        this.serviceName = 'ctop-agent';
        this._loggers = new Map();
        this.logger = null;
        this.configPath = __dirname + '/../conf/config.js';
        if (arguments.length > 0) {
            if (typeof configPath === 'object') {
                opt = configPath;
            }
            else {
                this.configPath = configPath;
            }
        }
        this.configPath = p.normalize(this.configPath);
        this.config = require(this.configPath).getConfig();
        this.config = utils.array_replace_recursive(this.config, opt);
        if (this.config.getLoggerFunction) {
            this.getLogger = opt.getLoggerFunction;
        }
        this.logger = this.getLogger(this.constructor.name);
        if (!this.config.dataDir) {
            this.config.dataDir = __dirname + '/../data';
        }
        else {
            this.config.dataDir = utils.replaceEnvVars(this.config.dataDir);
        }
        if (!this.config.tmpDir) {
            this.config.tmpDir = __dirname + '/../tmp';
        }
        else {
            this.config.tmpDir = utils.replaceEnvVars(this.config.tmpDir);
        }
        try {
            shell.mkdir('-p', this.config.tmpDir);
        }
        catch (e) {
            if (e.code !== 'EEXIST') {
                throw e;
            }
        }
        try {
            shell.mkdir('-p', this.config.dataDir);
        }
        catch (e) {
            if (e.code !== 'EEXIST') {
                throw e;
            }
        }
        this.config.logs = this.getLogsConfig();
    }
    static create(clazz, configPath, opt = {}) {
        if (Application._instance) {
            throw new Error('Application already created');
        }
        Application._instance = new clazz(configPath, opt);
        return Application._instance;
    }
    static getInstance() {
        return Application._instance;
    }
    static getLogger(name = null) {
        if (!Application._instance) {
            throw new Error('Application is not created');
        }
        return Application._instance.getLogger(name);
    }
    static getConfigDir() {
        return p.normalize(__dirname + '/../conf');
    }
    start() {
        return Promise.resolve(this);
    }
    getTmpDir() {
        return this.config.tmpDir;
    }
    getLogger(name = null) {
        if (name === null) {
            name = 'Main';
        }
        if (!this._loggers.has(name)) {
            let loggerConf = this.getLogsConfig().logger;
            loggerConf.name = name;
            this._loggers.set(name, bunyan.createLogger(loggerConf));
        }
        return this._loggers.get(name);
    }
    getDefaultLogConfig() {
        let r = {
            'http-access-log': {
                'enabled': true,
                'log-name': 'access.log',
                'log-dir': __dirname + '/../logs',
                'options': {
                    'size': '10M',
                    'maxFiles': 7
                }
            },
            'logger': {
                'level': 'info',
                'streams': [
                    {
                        'stream': process.stdout
                    },
                    {
                        'type': 'rotating-file',
                        'period': '1d',
                        'count': 7,
                        'path': __dirname + '/../logs/log.json'
                    }
                ]
            }
        };
        return r;
    }
    getLogsConfig() {
        if (!this.logsConfig) {
            this.logsConfig = {};
            if (!this.config.logs) {
                this.logsConfig = this.getDefaultLogConfig();
            }
            else {
                if (!this.config.logs['http-access-log']) {
                    this.logsConfig['http-access-log'] = this.getDefaultLogConfig()['http-access-log'];
                }
                else {
                    this.logsConfig['http-access-log'] = this.config.logs['http-access-log'];
                }
                if (!this.config.logs.logger) {
                    this.logsConfig.logger = this.getDefaultLogConfig().logger;
                }
                else {
                    this.logsConfig.logger = this.config.logs.logger;
                }
            }
            if (typeof this.logsConfig['http-access-log'] !== 'undefined') {
                let dir = utils.replaceEnvVars(this.logsConfig['http-access-log']['log-dir']);
                this.logsConfig['http-access-log']['log-dir'] = dir;
                try {
                    shell.mkdir('-p', dir);
                }
                catch (e) {
                    if (e.code !== 'EEXIST') {
                        throw e;
                    }
                }
            }
            if (typeof this.logsConfig.logger !== 'undefined') {
                for (let i = 0; i < this.logsConfig.logger.streams.length; i++) {
                    let stream = this.logsConfig.logger.streams[i];
                    if (stream.path) {
                        stream.path = utils.replaceEnvVars(stream.path);
                        stream.path = stream.path.replace('${PID}', process.pid);
                        let dir = path.dirname(stream.path);
                        try {
                            shell.mkdir('-p', dir);
                        }
                        catch (e) {
                            if (e.code !== 'EEXIST') {
                                throw e;
                            }
                        }
                    }
                }
            }
        }
        return this.logsConfig;
    }
}
exports.Application = Application;
Application.version = '2.6.2';
Application.applicationDirPath = __dirname;
Application._instance = null;
//# sourceMappingURL=Application.js.map