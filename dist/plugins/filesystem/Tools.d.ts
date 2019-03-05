import bunyan = require('bunyan');
export declare class Tools {
    protected tmpDir: string;
    protected logger: bunyan;
    constructor(opt: any);
    listFiles(dir: string): Promise<any>;
    findFiles(dir: string, filter: string, recursive: boolean, maxResults: number): Promise<any>;
    execScript(script: string, args?: any): Promise<any>;
    protected processKlawResults(items: any[], filter: string, maxResults: number): any;
}
