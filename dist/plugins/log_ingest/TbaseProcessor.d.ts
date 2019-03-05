/// <reference types="node" />
import EventEmitter = require('events');
import bunyan = require('bunyan');
export declare class TbaseProcessor extends EventEmitter {
    name: string;
    opt: any;
    logger: bunyan;
    constructor(name: string, opt: any);
    createMessage(data: any): any;
    loadRemoteConfig(data: any): Promise<{}>;
    setCommonProperties(data: any, message: any): any;
    getMessage(data: any): Promise<any>;
    getIndexName(message: any): void;
}
