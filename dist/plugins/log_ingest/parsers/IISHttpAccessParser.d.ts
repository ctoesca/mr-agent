import { TbaseParser } from './TbaseParser';
export declare class IISHttpAccessParser extends TbaseParser {
    protected directives: any[];
    constructor(masks: string[]);
    parse(line: string): any;
}
