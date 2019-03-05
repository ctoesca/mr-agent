import express = require('express');
import TbaseMetric from '../../TbaseMetric';
import IbaseMetric from '../../IbaseMetric';
import Promise = require('bluebird');
export declare class Tmetric extends TbaseMetric implements IbaseMetric {
    constructor(expressApp: express.Application, config: any);
    get(): Promise<any>;
    cpuFromLastMeasure(): Promise<{
        ellapsed: number;
        percentageCPU: number;
    }>;
    calc(startMeasure: any, endMeasure: any): {
        ellapsed: number;
        percentageCPU: number;
    };
    cpu(interval?: number): Promise<{
        ellapsed: number;
        percentageCPU: number;
    }>;
    format(format: string, params: any, result: any): any;
    cpuAverage(): {
        timestamp: number;
        idle: number;
        total: number;
    };
    getOldCpuMeasure(): Promise<any>;
    saveCpuMeasure(measure: any): void;
}
