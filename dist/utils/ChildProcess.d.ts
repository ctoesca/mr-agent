import * as Promise from 'bluebird';
import './StringTools';
export declare class ChildProcess {
    static spawn(path: string, args?: string[], opt?: any): Promise<{}>;
}
