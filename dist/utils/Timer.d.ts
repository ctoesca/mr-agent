/// <reference types="node" />
import EventEmitter = require('events');
export default class Timer extends EventEmitter {
    static ON_TIMER: string;
    delay: number;
    running: boolean;
    count: number;
    protected intervalID: NodeJS.Timeout;
    constructor(args: any);
    setInterval(i: number): void;
    destroy(): void;
    start(): void;
    reset(): void;
    stop(): void;
    protected _onTimer(): void;
}
