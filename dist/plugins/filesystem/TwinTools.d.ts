import { Tools } from './Tools';
export declare class TwinTools extends Tools {
    constructor(opt: any);
    execPowershell(script: string, args?: any): Promise<any>;
}
