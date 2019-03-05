/// <reference types="node" />
import EventEmitter = require('events');
import bunyan = require('bunyan');
export declare class TbaseParser extends EventEmitter {
    protected logger: bunyan;
    constructor();
    parse(line: string): void;
    escape(str: string): string;
}
