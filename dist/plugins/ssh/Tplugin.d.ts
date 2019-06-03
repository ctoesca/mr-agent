import { ThttpPlugin } from '../ThttpPlugin';
import { WorkerApplication as Application } from '../../WorkerApplication';
import express = require('express');
import * as Promise from 'bluebird';
import SshConnection from './SshConnection';
export declare class Tplugin extends ThttpPlugin {
    protected sshKeysDir: string;
    protected defaultPort: number;
    protected connectTimeout: number;
    constructor(application: Application, config: any);
    install(): void;
    upload(req: express.Request, res: express.Response, next: express.NextFunction): void;
    remoteFileExists(host: string, username: string, password: string, key: string, passphrase: string, remotePath: string, port: number): Promise<boolean>;
    download(req: express.Request, res: express.Response, next: express.NextFunction): void;
    exec(req: express.Request, res: express.Response, next: express.NextFunction): void;
    checkLogin(req: express.Request, res: express.Response, next: express.NextFunction): void;
    checkLogins(req: express.Request, res: express.Response, next: express.NextFunction): void;
    execMulti(req: express.Request, res: express.Response, next: express.NextFunction): void;
    _execMulti(destinations: any[], script: string): Promise<unknown>;
    protected _exec(opt: any, sshConnection?: SshConnection): Promise<any>;
    checkConnection(params: any): Promise<{
        result: boolean;
        params: any;
        error: null;
    }>;
    getConnection(params: any, options?: any): Promise<SshConnection>;
    protected removeTempFileSync(path: string): void;
    protected removeTempDir(dir: string): void;
    protected scpSend(host: string, username: string, password: string, key: string, passphrase: string, localPath: string, remotePath: string, port: number): Promise<unknown>;
    protected scpGet(host: string, username: string, password: string, key: string, passphrase: string, localPath: string, remotePath: string, port: number): Promise<unknown>;
}
