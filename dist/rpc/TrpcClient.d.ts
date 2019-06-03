/// <reference types="node" />
import EventEmitter = require('events');
import WebSocket = require('ws');
import * as Promise from 'bluebird';
import bunyan = require('bunyan');
export declare class TrpcClient extends EventEmitter {
    protected connectTimer: NodeJS.Timeout;
    protected ws: WebSocket;
    protected modules: any;
    protected opt: any;
    protected logger: bunyan;
    constructor(opt: any);
    connect(): Promise<unknown>;
    auth(): void;
    init(args: any): void;
    send(msg: any): void;
    onWebsocketMessage(message: string): void;
}
