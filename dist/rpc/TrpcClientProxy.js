"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrpcClientProxy = void 0;
const EventEmitter = require("events");
const Application_1 = require("../Application");
const Promise = require("bluebird");
class TrpcClientProxy extends EventEmitter {
    constructor(opt) {
        super();
        this.connectTimer = null;
        this.ws = null;
        this.modules = {};
        this.opt = null;
        this.logger = null;
        this.opt = opt;
        this.logger = Application_1.Application.getLogger('TrpcClientProxy');
        process.on('message', (msg) => {
            this.onWebsocketMessage(msg);
        });
    }
    registerModule(name, module) {
        this.modules[name] = new module({
            rpcClient: this,
            name: name
        });
    }
    getModuleMethod(path) {
        let parts = path.split('.');
        if (parts.length < 2) {
            throw 'RPC Method is incomplete. Example method: module1.method1';
        }
        else {
            let moduleName = parts[0];
            if (typeof this.modules[moduleName] === 'undefined') {
                throw 'unknown RPC module: ' + moduleName + "'";
            }
            else {
                let module = this.modules[moduleName];
                return module.getModuleMethod(path.rightOf('.'));
            }
        }
    }
    send(msg) {
        process.send({
            rpc: msg
        });
    }
    onWebsocketMessage(message) {
        return new Promise((resolve, reject) => {
            if (typeof message !== 'object') {
                reject('onWebsocketMessage: message is not a object');
            }
            else {
                if (!message.method || !message.type) {
                    reject("'plugin' or 'method' or 'type' property is missing");
                }
                else {
                    if (message.type === 'rpc') {
                        let method = this.getModuleMethod(message.method);
                        if (method === null) {
                            reject("unknown method '" + message.method + "'");
                        }
                        else {
                            try {
                                resolve(method(message.args));
                            }
                            catch (err) {
                                reject(err.toString());
                            }
                        }
                    }
                    else {
                        reject("unknown message type : '" + message.type + "'");
                    }
                }
            }
        })
            .then(result => {
            this.logger.info('RPC RESULT = ', result);
            this.send({
                status: 0,
                result: result,
                correlationId: message.correlationId
            });
        })
            .catch(err => {
            this.logger.error('WebsocketMessage: ', err);
            this.logger.error('WebsocketMessage message: ', message);
            this.send({
                status: 1,
                correlationId: message.correlationId,
                error: err.toString()
            });
        });
    }
}
exports.TrpcClientProxy = TrpcClientProxy;
//# sourceMappingURL=TrpcClientProxy.js.map