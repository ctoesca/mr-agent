import TbaseMetric from '../../TbaseMetric';
import IbaseMetric from '../../IbaseMetric';
import express = require('express');
import Promise = require('bluebird');
export declare class Tmetric extends TbaseMetric implements IbaseMetric {
    constructor(expressApp: express.Application, config: any);
    get(args?: any): Promise<any>;
    format(format: string, params: any, result: any): any;
}
