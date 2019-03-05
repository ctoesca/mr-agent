import { TbaseModule } from '../TbaseModule';
import Promise = require('bluebird');
export declare class Ttest2 extends TbaseModule {
    constructor(opt: any);
    test1(args: any): string;
    checkPhysicalMem(args: any): Promise<any>;
}
