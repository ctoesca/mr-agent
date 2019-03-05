import { ThttpPlugin } from '../ThttpPlugin';
import { WorkerApplication as Application } from '../../WorkerApplication';
import express = require('express');
import TbaseMetric from './TbaseMetric';
export declare class Tplugin extends ThttpPlugin {
    metrics: Map<string, TbaseMetric>;
    constructor(application: Application, config: any);
    install(): void;
    getInfos(req: express.Request, res: express.Response, next: express.NextFunction): void;
    loadMetrics(): Promise<void>;
    getMetric(name: string): TbaseMetric;
}
