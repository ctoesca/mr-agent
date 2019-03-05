import { ThttpPlugin } from '../ThttpPlugin.js';
import '../../utils/StringTools';
import { WorkerApplication as Application } from '../../WorkerApplication';
import express = require('express');
export declare class Tplugin extends ThttpPlugin {
    protected ipHash: Map<string, any>;
    constructor(application: Application, config: any);
    install(): void;
    dnsReverse(req: express.Request, res: express.Response, next: express.NextFunction): void;
}
