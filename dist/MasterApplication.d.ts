import Timer from './utils/Timer';
import { Application } from './Application';
export declare class MasterApplication extends Application {
    workersStats: any;
    protected workers: Map<number, any>;
    protected workersArray: any[];
    protected statTimer: Timer;
    protected purgeTimer: Timer;
    protected lastStat: Date;
    protected numProcesses: any;
    protected tmpFilesRetention: number;
    protected tmpPurgeInterval: number;
    constructor(configPath: string, opt?: any);
    execScript(script: string): Promise<unknown>;
    onPurgeTimer(): void;
    onStatTimer(): void;
    protected onExitWorker(worker: any, code: number, signal: string): void;
    protected onWorkerMessage(msg: any): void;
    protected onForkWorker(worker: any): void;
}
