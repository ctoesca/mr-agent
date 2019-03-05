import { TbaseParser } from './TbaseParser';
export declare class HttpAccessParser extends TbaseParser {
    protected parsers: any[];
    constructor(masks: string[]);
    parse(line: string): any;
}
