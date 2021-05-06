"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = exports.Updater = exports.WorkerApplication = exports.MasterApplication = exports.Application = void 0;
const Application_1 = require("./Application");
var Application_2 = require("./Application");
Object.defineProperty(exports, "Application", { enumerable: true, get: function () { return Application_2.Application; } });
var MasterApplication_1 = require("./MasterApplication");
Object.defineProperty(exports, "MasterApplication", { enumerable: true, get: function () { return MasterApplication_1.MasterApplication; } });
var WorkerApplication_1 = require("./WorkerApplication");
Object.defineProperty(exports, "WorkerApplication", { enumerable: true, get: function () { return WorkerApplication_1.WorkerApplication; } });
var Updater_1 = require("./autoUpdate/Updater");
Object.defineProperty(exports, "Updater", { enumerable: true, get: function () { return Updater_1.Updater; } });
function create(clazz, configPath, opt = {}) {
    return Application_1.Application.create(clazz, configPath, opt);
}
exports.create = create;
//# sourceMappingURL=index.js.map