import { TbaseProcessor } from '../TbaseProcessor';
export declare class Tprocessor extends TbaseProcessor {
    protected levels: any;
    constructor(name: string, opt: any);
    createMessage(data: any): any;
    getMessage(data: any): Promise<any>;
    getIndexName(message: any): string;
}
