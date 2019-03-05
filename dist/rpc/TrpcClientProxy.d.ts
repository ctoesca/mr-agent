/// <reference types="node" />
import EventEmitter = require('events');
import WebSocket = require('ws');
import bunyan = require('bunyan');
import * as Promise from 'bluebird';
export declare class TrpcClientProxy extends EventEmitter {
    protected connectTimer: NodeJS.Timeout;
    protected ws: WebSocket;
    protected modules: any;
    protected opt: any;
    protected logger: bunyan;
    constructor(opt: any);
    registerModule(name: string, module: any): void;
    getModuleMethod(path: string): any;
    send(msg: any): void;
    onWebsocketMessage(message: any): Promise<void>;
}
