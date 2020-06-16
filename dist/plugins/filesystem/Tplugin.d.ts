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
    downloadFilePart(req: express.Request, res: express.Response, next: express.NextFunction): void;
    getUploadPartDirectory(uid: string, createIfNotExists?: boolean): string;
    uploadPart(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void>;
    mergeFileParts(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void>;
    upload(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void>;
    writeTextFile(req: express.Request, res: express.Response, next: express.NextFunction): void;
    execScript(req: express.Request, res: express.Response, next: express.NextFunction): void;
    download(req: express.Request, res: express.Response, next: express.NextFunction): void;
    deleteFiles(req: express.Request, res: express.Response, next: express.NextFunction): void;
    createDir(req: express.Request, res: express.Response, next: express.NextFunction): void;
    moveFile(req: express.Request, res: express.Response, next: express.NextFunction): void;
    copyFile(req: express.Request, res: express.Response, next: express.NextFunction): void;
    uncompressFile(req: express.Request, res: express.Response, next: express.NextFunction): void;
    fileinfo(req: express.Request, res: express.Response, next: express.NextFunction): void;
    fileExists(req: express.Request, res: express.Response, next: express.NextFunction): void;
    list(req: express.Request, res: express.Response, next: express.NextFunction): void;
}
