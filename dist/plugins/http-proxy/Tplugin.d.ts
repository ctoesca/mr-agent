import { TbasePlugin } from '../TbasePlugin';
import { WorkerApplication as Application } from '../../WorkerApplication';
export declare class Tplugin extends TbasePlugin {
    constructor(application: Application, config: any);
    install(): void;
}
