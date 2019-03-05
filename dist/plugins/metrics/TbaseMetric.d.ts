import IbaseMetric from './IbaseMetric';
import express = require('express');
import bunyan = require('bunyan');
import { WorkerApplication as Application } from '../../WorkerApplication';
import Promise = require('bluebird');
export default class TbaseMetric implements IbaseMetric {
    name: any;
    protected app: express.Application;
    protected config: any;
    protected application: Application;
    protected logger: bunyan;
    constructor(expressApp: express.Application, config: any);
    format(format: string, params: any, result: any): any;
    getInfos(): any;
    getRequest(req: express.Request, res: express.Response, next: express.NextFunction): void;
    convertBytesToGo(v: number): number;
    get(args?: any): Promise<any>;
}
