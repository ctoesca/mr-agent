/// <reference types="node" />
import bunyan = require('bunyan');
import EventEmitter = require('events');
import { WorkerApplication as Application } from '../WorkerApplication';
export declare class TbasePlugin extends EventEmitter {
    config: any;
    name: string;
    protected tmpDir: string;
    protected logger: bunyan;
    protected application: Application;
    constructor(application: Application, config: any);
    install(): void;
}
