import { ThttpPlugin } from '../ThttpPlugin';
import { WorkerApplication as Application } from '../../WorkerApplication';
import express = require('express');
import * as Promise from 'bluebird';
import { SshConnection } from './SshConnection';
import ws = require('ws');
import { SshSession } from './SshSession';
import Timer from '../../utils/Timer';
import genericPool = require('generic-pool');
export declare class Tplugin extends ThttpPlugin {
    sshKeysDir: string;
    connectTimeout: number;
    protected defaultPort: number;
    protected websocketDataServer: ws.Server;
    protected sshSessions: Map<string, SshSession>;
    protected pooledConnections: Map<string, SshConnection>;
    protected statTimer: Timer;
    protected statTimerInterval: number;
    protected statInterval: number;
    protected lastStatDate: number;
    protected currentRequestsCount: number;
    protected poolCacheHits: number;
    protected connectCacheHits: number;
    protected createdPools: number;
    pools: Map<string, genericPool.Pool<SshConnection>>;
    poolsOptions: any;
    constructor(application: Application, config: any);
    protected onStatTimer(): void;
    razCache(): Promise<{
        result: boolean;
    }>;
    getStats(): Promise<any>;
    install(): void;
    addPrivateKey(req: express.Request, res: express.Response, next: express.NextFunction): void;
    removeAllPrivateKeys(req: express.Request, res: express.Response, next: express.NextFunction): void;
    removePrivateKey(req: express.Request, res: express.Response, next: express.NextFunction): void;
    httpForward(req: express.Request, res: express.Response, next: express.NextFunction): void;
    createTcpServer(): void;
    onDataConnection(conn: ws, req: any): void;
    verifyClient(info: any, done: Function): void;
    _stats(req: express.Request, res: express.Response, next: express.NextFunction): void;
    _razCache(req: express.Request, res: express.Response, next: express.NextFunction): void;
    upload(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void>;
    fileinfo(opt: any): Promise<any>;
    protected getFileObjectFromLsLineResult(line: string, regexp?: any): any;
    remoteFileExists(host: string, username: string, password: string, key: string, passphrase: string, remotePath: string, port: number): Promise<boolean>;
    download(req: express.Request, res: express.Response, next: express.NextFunction): void;
    fileinfoRequest(req: express.Request, res: express.Response, next: express.NextFunction): void;
    exec(req: express.Request, res: express.Response, next: express.NextFunction): void;
    checkLogin(req: express.Request, res: express.Response, next: express.NextFunction): void;
    checkLogins(req: express.Request, res: express.Response, next: express.NextFunction): void;
    execMulti(req: express.Request, res: express.Response, next: express.NextFunction): void;
    _execMulti(destinations: any[], script: string): Promise<unknown>;
    checkConnection(params: any): Promise<{
        result: boolean;
        params: any;
        error: null;
    }>;
    protected _shell(req: express.Request, res: express.Response, next: express.NextFunction): void;
    protected _exec(opt: any, sshConnection?: SshConnection): Promise<any>;
    protected removeTempFileSync(path: string): void;
    protected removeTempDir(dir: string): void;
    sftpReaddir(req: express.Request, res: express.Response, next: express.NextFunction): void;
    scpSend(host: string, username: string, password: string, key: string, passphrase: string, localPath: string, remotePath: string, port: number, opt?: any): Promise<unknown>;
    scpGet(host: string, username: string, password: string, key: string, passphrase: string, localPath: string, remotePath: string, port: number, opt?: any): Promise<unknown>;
    getConnection(params: any, options?: any): Promise<SshConnection>;
    createSshConnection(params: any, poolId?: any, options?: any): SshConnection;
    getConnectionPool(poolId: string, params: any): genericPool.Pool<SshConnection>;
    releaseSshConnection(connection: SshConnection): void;
}
