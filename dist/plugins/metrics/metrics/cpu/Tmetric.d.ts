import express = require('express');
import TbaseMetric from '../../TbaseMetric';
import IbaseMetric from '../../IbaseMetric';
import Promise = require('bluebird');
export declare class Tmetric extends TbaseMetric implements IbaseMetric {
    constructor(expressApp: express.Application, config: any);
    get(): Promise<any>;
    cpu(interval?: number): Promise<{
        ellapsed: number;
        cores: number;
        total: {
            norm: {
                pct: number;
            };
        };
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
