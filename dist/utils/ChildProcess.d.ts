import * as Promise from 'bluebird';
import './StringTools';
export declare class ChildProcess {
    static spawnCmd(cmd: string, args: string[]): Promise<unknown>;
    static execCmd(cmd: string, args: string[]): Promise<unknown>;
}
