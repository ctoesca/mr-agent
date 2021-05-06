import { TbaseProcessor } from '../TbaseProcessor';
export declare class Tprocessor extends TbaseProcessor {
    protected ipHash: Map<string, any>;
    protected IPmask: RegExp;
    protected levels: any;
    constructor(name: string, opt: any);
    createMessage(data: any): any;
    dnsReverse(ip: string): Promise<any>;
    isValidIp(ip: string): boolean;
    getMessage(data: any): Promise<any>;
    getIndexName(message: any): any;
}
