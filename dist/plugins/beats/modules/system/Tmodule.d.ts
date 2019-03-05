/// <reference types="node" />
import TbaseModule from '../../TbaseModule';
import IbaseModule from '../../IbaseModule';
import os = require('os');
export default class Tmodule extends TbaseModule implements IbaseModule {
    protected oldCpus: any;
    constructor(config: any);
    processes(): void;
    memory(): Promise<void>;
    load(): void;
    cpu(): Promise<void>;
    protected getMetricset(metricName: string): {
        name: string;
        module: any;
    };
    protected getOldCpus(): Promise<any>;
    protected getCpus(): os.CpuInfo[];
    protected onTimer(): void;
}
