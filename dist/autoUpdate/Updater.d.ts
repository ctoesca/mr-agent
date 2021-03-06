/// <reference types="node" />
import express = require('express');
import bunyan = require('bunyan');
import Bluebird = require('bluebird');
import EventEmitter = require('events');
import { WorkerApplication } from '../WorkerApplication';
export declare class Updater extends EventEmitter {
    static updateIsRunning: boolean;
    protected static excludedFromBackup: string[];
    protected static excludedFromUpdate: string[];
    application: WorkerApplication;
    logger: bunyan;
    constructor(application: WorkerApplication);
    protected waitPurgeCompleted(waitPurgeCompletedStartDate?: number): any;
    onUpdateRequest(req: express.Request, res: express.Response, next: express.NextFunction): void;
    execUpdate(zipPath: string): void;
    execUpdateStep2(appDir: string, updateDir: string, appUrl: string): Bluebird<void>;
    protected getAppDir(): string;
    protected backup(backupDir: string): void;
    protected uncompressPackage(zipPath: string, newVersionCopyDir: string): void;
    protected stopApp(appDir: string, appUrl: string): Bluebird<any>;
    protected startApp(appDir: string): Bluebird<any>;
    protected remove(appDir: string): void;
    protected copy(updateDir: string, appDir: string): void;
}
