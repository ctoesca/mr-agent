/// <reference types="bunyan" />
import express = require('express');
import * as Promise from 'bluebird';
import { WorkerApplication } from '../WorkerApplication';
export declare class HttpTools {
    static getApplication(): WorkerApplication;
    static getLogger(): import("bunyan");
    static getSslCertificate(opt: any): Promise<unknown>;
    protected static pemEncode(str: string, n: number): string;
    static saveUploadedFile(req: express.Request, res: express.Response, next: express.NextFunction, opt?: any): Promise<any>;
    static checkUploadSize(destFilePath: string, req: express.Request, max?: number): Promise<any>;
    static sendZipFile(res: express.Response, next: express.NextFunction, path: string, zipFileName: string): Promise<any>;
    static getBodyParams(req: express.Request, fields: any): any;
    static getQueryParams(req: express.Request, fields: any): any;
}
