/// <reference types="node" />
import fs = require('fs-extra');
import * as Promise from 'bluebird';
import './StringTools';
export declare class Files {
    static getFilePart(path: string, blocNum: number, blocksize?: number): Promise<{
        stream: fs.ReadStream;
        start: number;
        end: number;
        totalSize: number;
    }>;
    static mergeFiles(files: string[], destPath: string, deletePartsOnSuccess?: boolean): Promise<unknown>;
    private static appendFileToStream;
    static isDir(path: string): Promise<unknown>;
    static getFileName(path: string): any;
    static getFileSize(path: string): number;
    static getFileStat(path: string, includeMime?: boolean): any;
}
