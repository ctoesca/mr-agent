"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mrAgent = require(".");
const utils = require("./utils");
const parseArgs = require("minimist");
const cluster = require("cluster");
const os = require("os");
if (utils.isWin()) {
    let osRelease = os.release();
    let isLessThanWin2008 = (osRelease.split('.')[0] < 6);
    if (isLessThanWin2008) {
        console.error('MR-Agent is not compatible with ' + osRelease);
        process.exit(1);
    }
}
let args = parseArgs(process.argv.slice(2));
let configPath = __dirname + '/../conf/config.js';
if (args.c) {
    configPath = args.c;
}
if (cluster.isMaster) {
    let app = mrAgent.create(mrAgent.MasterApplication, configPath);
    app.start();
}
else {
    let app = mrAgent.create(mrAgent.WorkerApplication, configPath);
    app.start();
}
//# sourceMappingURL=starter.js.map