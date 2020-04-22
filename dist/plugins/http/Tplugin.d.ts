import { ThttpPlugin } from '../ThttpPlugin.js';
import '../../utils/StringTools';
import { WorkerApplication as Application } from '../../WorkerApplication';
import express = require('express');
import Timer from '../../utils/Timer';
export declare class Tplugin extends ThttpPlugin {
    protected runningRequests: number;
    protected totalRequests: number;
    protected totalRequestsInIterval: number;
    protected statInterval: number;
    protected requestsPerSec: number;
    protected statTimer: Timer;
    constructor(application: Application, config: any);
    install(): void;
    onStatTimer(): void;
    _stats(req: express.Request, res: express.Response, next: express.NextFunction): void;
    getStats(): Promise<any>;
    request(req: express.Request, res: express.Response): void;
}
