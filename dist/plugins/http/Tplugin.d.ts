import { ThttpPlugin } from '../ThttpPlugin.js';
import '../../utils/StringTools';
import { WorkerApplication as Application } from '../../WorkerApplication';
import express = require('express');
import Timer from '../../utils/Timer';
import * as Promise from 'bluebird';
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
    parseQueryString(req: express.Request, res: express.Response, next: express.NextFunction): void;
    _stats(req: express.Request, res: express.Response, next: express.NextFunction): void;
    getStats(): Promise<any>;
    getSslCertificate(req: express.Request, res: express.Response, next: express.NextFunction): void;
    protected isHttp(hostname: string, port: number): Promise<boolean>;
    requests(req: express.Request, res: express.Response, next: express.NextFunction): void;
    request(req: express.Request, res: express.Response, next: express.NextFunction): void;
    _request(body: any): Promise<unknown>;
}
