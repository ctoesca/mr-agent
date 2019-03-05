"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Application_1 = require("./Application");
var Application_2 = require("./Application");
exports.Application = Application_2.Application;
var MasterApplication_1 = require("./MasterApplication");
exports.MasterApplication = MasterApplication_1.MasterApplication;
var WorkerApplication_1 = require("./WorkerApplication");
exports.WorkerApplication = WorkerApplication_1.WorkerApplication;
var Updater_1 = require("./autoUpdate/Updater");
exports.Updater = Updater_1.Updater;
function create(clazz, configPath, opt = {}) {
    return Application_1.Application.create(clazz, configPath, opt);
}
exports.create = create;
//# sourceMappingURL=index.js.map