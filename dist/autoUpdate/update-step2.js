"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parseArgs = require("minimist");
const mrAgent = require("..");
let args = parseArgs(process.argv.slice(2));
let configPath = __dirname + '/../../conf/config.js';
if (args.c) {
    configPath = args.c;
}
let updateDir = null;
if (args.updateDir) {
    updateDir = args.updateDir;
}
else {
    throw 'Missing argument: --updateDir';
}
let appUrl = null;
if (args.appUrl) {
    appUrl = args.appUrl;
}
else {
    throw 'Missing argument: --appUrl';
}
let appDir = null;
if (args.appDir) {
    appDir = args.appDir;
}
else {
    throw 'Missing argument: --appDir';
}
let app = mrAgent.create(mrAgent.WorkerApplication, configPath);
let updater = new mrAgent.Updater(app);
updater.execUpdateStep2(appDir, updateDir, appUrl)
    .catch((err) => {
    console.log(err);
});
//# sourceMappingURL=update-step2.js.map