import TbaseModule from '../../TbaseModule';
import IbaseModule from '../../IbaseModule';
import Promise = require('bluebird');
export default class Tmodule extends TbaseModule implements IbaseModule {
    protected mbeans: any[];
    protected path: string;
    protected namespace: 'metrics';
    constructor(config: any);
    onTimer(): void;
    setValue(obj: any, path: string, value: any): void;
    getMbeans(host: string, body: any): Promise<any>;
    protected getMetricset(metricName: string, host: string): {
        name: string;
        module: any;
        namespace: string;
        host: string;
    };
}
