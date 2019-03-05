"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const EventEmitter = require("events");
class TbaseModule extends EventEmitter {
    constructor(opt) {
        super();
        this.opt = null;
        this.name = null;
        this.rpcClient = null;
        this.modules = {};
        this.opt = opt;
        this.name = opt.name;
        this.rpcClient = opt.rpcClient;
    }
    registerModule(name, module) {
        this.modules[name] = new module({
            rpcClient: this.rpcClient,
            name: name
        });
    }
    getModuleMethod(path) {
        if (!path.contains('.')) {
            if (typeof this[path] !== 'undefined') {
                return this[path].bind(this);
            }
            else {
                throw "Method '" + path + "' does not exist on module '" + this.name + "'";
            }
        }
        else {
            let parts = path.split('.');
            let moduleName = parts[0];
            if (typeof this.modules[moduleName] !== 'object') {
                throw "Module '" + moduleName + "' does not exist on module " + this.name;
            }
            let module = this.modules[moduleName];
            return module.getModuleMethod(path.rightOf(moduleName + '.'));
        }
    }
}
exports.TbaseModule = TbaseModule;
//# sourceMappingURL=TbaseModule.js.map