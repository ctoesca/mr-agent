import express = require('express');
import * as Promise from 'bluebird';
export declare class HttpTools {
    static saveUploadedFile(req: express.Request, res: express.Response, next: express.NextFunction, opt?: any): Promise<any>;
    static sendZipFile(res: express.Response, next: express.NextFunction, path: string, zipFileName: string): Promise<any>;
    static getBodyParams(req: express.Request, fields: any): any;
    static getQueryParams(req: express.Request, fields: any): any;
}
