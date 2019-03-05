import { ThttpPlugin } from '../ThttpPlugin.js';
import '../../utils/StringTools';
import { WorkerApplication as Application } from '../../WorkerApplication';
import Timer from '../../utils/Timer';
import express = require('express');
export declare class Tplugin extends ThttpPlugin {
    protected runningRequestCount: number;
    protected requestCount: number;
    protected statTimer: Timer;
    constructor(application: Application, config: any);
    install(): void;
    onStatTimer(): void;
    request(req: express.Request, res: express.Response): void;
}
