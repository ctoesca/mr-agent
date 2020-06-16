"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrpcClient = void 0;
const EventEmitter = require("events");
const Application_1 = require("../Application");
const WebSocket = require("ws");
const Promise = require("bluebird");
const os = require("os");
class TrpcClient extends EventEmitter {
    constructor(opt) {
        super();
        this.connectTimer = null;
        this.ws = null;
        this.modules = {};
        this.opt = null;
        this.logger = null;
        this.opt = opt;
        this.logger = Application_1.Application.getLogger('TrpcClient');
    }
    connect() {
        return new Promise((resolve, reject) => {
            let ws = new WebSocket(this.opt.url);
            ws.on('open', () => {
                this.ws = ws;
                this.emit('connected');
                ws.on('close', (code, message) => {
                    this.ws = null;
                    this.logger.error('WEBSOCKET CLOSED code=' + code + ', message=' + message);
                    this.emit('disconnected');
                });
                resolve(ws);
                this.auth();
            });
            ws.on('error', (err) => {
                this.ws = null;
                reject(err);
            });
        });
    }
    auth() {
        let msg = {
            rpc: {
                args: {
                    hostname: os.hostname()
                }
            }
        };
        this.send(msg);
    }
    init(args) {
        this.logger.info(args);
        this.connectTimer = setInterval(() => {
            if (this.ws === null) {
                this.connect()
                    .then((ws) => {
                    this.logger.error('CONNECTED TO WEBSOCKET SERVER');
                    ws.on('message', this.onWebsocketMessage.bind(this));
                })
                    .catch(err => {
                    this.logger.error('WEBSOCKET CONNECT ERROR ', err);
                });
            }
        }, 5000);
    }
    send(msg) {
        this.ws.send(JSON.stringify(msg));
    }
    onWebsocketMessage(message) {
        let messageObject = null;
        try {
            try {
                messageObject = JSON.parse(message);
            }
            catch (err) {
                throw 'malformed message (not JSON): ' + err.toString();
            }
            if (!messageObject.method || !messageObject.type) {
                throw "'plugin' or 'method' or 'type' property is missing";
            }
            else if (messageObject.type === 'rpc') {
                this.emit('rpc-message', messageObject);
            }
            else {
                throw "unknown message type : '" + messageObject.type + "'";
            }
        }
        catch (err) {
            this.logger.error(messageObject);
            this.logger.error('onWebsocketMessage :' + err.toString());
        }
    }
}
exports.TrpcClient = TrpcClient;
//# sourceMappingURL=TrpcClient.js.map