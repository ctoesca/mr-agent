import { TbasePlugin } from '../TbasePlugin';
import TbaseModule from './TbaseModule';
import { WorkerApplication as Application } from '../../WorkerApplication';
import elasticsearch = require('elasticsearch');
import Timer from '../../utils/Timer';
export declare class Tplugin extends TbasePlugin {
    modules: Map<string, TbaseModule>;
    protected elasticClient: elasticsearch.Client;
    protected hostname: string;
    protected beatsVersion: string;
    protected collectedMetrics: any[];
    protected elasticDataToSend: any[];
    protected timer: Timer;
    protected beatsConfig: any;
    protected maxCachedMetrics: number;
    protected sendingData: boolean;
    constructor(application: Application, config: any);
    install(): void;
    getModule(name: string): TbaseModule;
    protected loadBeats(): void;
    protected createMetric(module: TbaseModule, metricset: any): any;
    protected onMetric(module: TbaseModule, metricset: any, data: any): void;
    protected onError(module: TbaseModule, metricset: any, err: any): void;
    protected genUID(metric: any): string;
    protected onTimer(): void;
    protected sendToElastic(): Promise<void>;
}
