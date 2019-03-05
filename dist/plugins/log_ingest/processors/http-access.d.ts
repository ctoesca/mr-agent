import { TbaseParser } from '../parsers/TbaseParser';
import { TbaseProcessor } from '../TbaseProcessor';
export declare class Tprocessor extends TbaseProcessor {
    constructor(name: string, opt: any);
    parseConfig(): void;
    createParser(node: any): void;
    setParsers(node: any): void;
    getParser(data: any): TbaseParser;
    createMessage(data: any): any;
    getMessage(data: any): Promise<any>;
    getIndexName(message: any): string;
}
