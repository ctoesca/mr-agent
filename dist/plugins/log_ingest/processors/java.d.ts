import { TbaseProcessor } from '../TbaseProcessor';
export declare class Tprocessor extends TbaseProcessor {
    protected levels: any;
    protected data1RegExp: RegExp;
    constructor(name: string, opt: any);
    getMessage(data: any): Promise<any>;
    getIndexName(message: any): string;
}
