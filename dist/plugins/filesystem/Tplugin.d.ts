import { Tools } from './Tools';
import { ThttpPlugin } from '../ThttpPlugin';
import express = require('express');
import '../../utils/StringTools';
import { WorkerApplication as Application } from '../../WorkerApplication';
import Promise = require('bluebird');
export declare class Tplugin extends ThttpPlugin {
    protected tools: Tools;
    constructor(application: Application, config: any);
    install(): void;
    writeTextFile(req: express.Request, res: express.Response, next: express.NextFunction): void;
    execScript(req: express.Request, res: express.Response, next: express.NextFunction): void;
    checkUploadSize(destFilePath: string, req: express.Request): Promise<any>;
    upload(req: express.Request, res: express.Response, next: express.NextFunction): void;
    download(req: express.Request, res: express.Response, next: express.NextFunction): void;
    deleteFiles(req: express.Request, res: express.Response, next: express.NextFunction): void;
    moveFile(req: express.Request, res: express.Response, next: express.NextFunction): void;
    copyFile(req: express.Request, res: express.Response, next: express.NextFunction): void;
    fileinfo(req: express.Request, res: express.Response, next: express.NextFunction): void;
    fileExists(req: express.Request, res: express.Response, next: express.NextFunction): void;
    list(req: express.Request, res: express.Response, next: express.NextFunction): void;
}
