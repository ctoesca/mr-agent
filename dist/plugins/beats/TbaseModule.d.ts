/// <reference types="node" />
import IbaseModule from './IbaseModule';
import bunyan = require('bunyan');
import EventEmitter = require('events');
import { WorkerApplication as Application } from '../../WorkerApplication';
import Timer from '../../utils/Timer';
export default class TbaseModule extends EventEmitter implements IbaseModule {
    name: any;
    protected config: any;
    protected application: Application;
    protected logger: bunyan;
    protected timer: Timer;
    constructor(config: any);
    protected getHost(): {
        name: string;
    };
    protected onTimer(): void;
}
