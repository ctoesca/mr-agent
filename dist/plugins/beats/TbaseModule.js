"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const EventEmitter = require("events");
const fs = require("fs-extra");
const os = require("os");
const WorkerApplication_1 = require("../../WorkerApplication");
const Timer_1 = require("../../utils/Timer");
class TbaseModule extends EventEmitter {
    constructor(config) {
        super();
        this.name = null;
        this.config = null;
        this.timer = null;
        this.config = config;
        this.name = config.name;
        this.application = config.application;
        this.logger = WorkerApplication_1.WorkerApplication.getLogger('beats.' + this.name);
        if (this.config.data.enabled) {
            fs.ensureDir(this.config.tmpDir);
            let period = this.config.data.period.replace('s', '') * 1000;
            this.timer = new Timer_1.default({ delay: period });
            this.timer.on(Timer_1.default.ON_TIMER, this.onTimer.bind(this));
            this.timer.start();
        }
    }
    getHost() {
        return {
            name: os.hostname()
        };
    }
    onTimer() {
        throw 'onTimer: not implemented';
    }
}
exports.default = TbaseModule;
//# sourceMappingURL=TbaseModule.js.map