import * as Promise from 'bluebird';
import './StringTools';
export declare class Files {
    static isDir(path: string): Promise<{}>;
    static getFileName(path: string): any;
    static getFileSize(path: string): number;
    static getFileStat(path: string, includeMime?: boolean): any;
}
