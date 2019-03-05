import Promise = require('bluebird');
export default interface IbaseMetric {
    convertBytesToGo(v: number): number;
    get(args: any): Promise<any>;
    format(format: string, params: any, result: any): any;
    getInfos(): any;
}
