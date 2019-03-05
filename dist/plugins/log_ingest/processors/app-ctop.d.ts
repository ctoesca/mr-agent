import { TbaseProcessor } from '../TbaseProcessor';
export declare class Tprocessor extends TbaseProcessor {
    constructor(name: string, opt: any);
    createMessage(data: any): any;
    getMessage(data: any): any;
    getIndexName(message: any): string;
}
