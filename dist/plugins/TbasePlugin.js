"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TbasePlugin = void 0;
const EventEmitter = require("events");
const WorkerApplication_1 = require("../WorkerApplication");
const shell = require("shelljs");
class TbasePlugin extends EventEmitter {
    constructor(application, config) {
        super();
        this.config = null;
        this.name = null;
        this.tmpDir = null;
        this.logger = null;
        this.application = null;
        this.application = application;
        this.config = config;
        this.name = config.name;
        this.tmpDir = config.tmpDir;
        this.logger = WorkerApplication_1.WorkerApplication.getLogger(this.name);
        try {
            shell.mkdir('-p', this.tmpDir);
        }
        catch (e) {
            if (e.code !== 'EEXIST') {
                throw e;
            }
        }
    }
    install() {
        this.logger.debug('Plugin ' + this.name + ' installed: opt=', this.config);
    }
}
exports.TbasePlugin = TbasePlugin;
//# sourceMappingURL=TbasePlugin.js.map