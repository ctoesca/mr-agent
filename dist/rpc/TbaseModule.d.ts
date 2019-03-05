/// <reference types="node" />
import EventEmitter = require('events');
import { TrpcClient } from './TrpcClient';
export declare class TbaseModule extends EventEmitter {
    protected opt: any;
    protected name: string;
    protected rpcClient: TrpcClient;
    protected modules: any;
    constructor(opt: any);
    registerModule(name: string, module: any): void;
    getModuleMethod(path: string): any;
}
