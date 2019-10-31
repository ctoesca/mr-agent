/// <reference types="node" />
import Ssh2 = require('ssh2');
import * as Promise from 'bluebird';
import EventEmitter = require('events');
import bunyan = require('bunyan');
import '../../utils/StringTools';
import HttpAgent from './HttpAgent';
import HttpsAgent from './HttpsAgent';
export default class SshConnection extends EventEmitter {
    protected static cachedKeys: Map<string, string>;
    conn: Ssh2.Client;
    protected sshKeysDir: string;
    protected connectTimeout: number;
    protected logger: bunyan;
    protected connectPromise: Promise<Ssh2.Client>;
    protected connectionParams: any;
    lastUse: number;
    id: string;
    httpsAgent: HttpsAgent;
    httpAgent: HttpAgent;
    validSshOptions: any;
    constructor(connectionParams: any, options: any);
    toString(): string;
    static calcId(params: any): string;
    getHttpAgent(https?: boolean): HttpAgent | HttpsAgent;
    getNewSshClient(): Ssh2.Client;
    destroy(): void;
    close(): void;
    isConnected(): boolean;
    connect(): Promise<Ssh2.Client>;
    findKeyConnection(sshOptions: any): Promise<Ssh2.Client>;
    protected getSshKeyCache(host: string, port: number): string;
    protected _connect(sshOptions: any): Promise<Ssh2.Client>;
    protected getKeyConnection(sshOptions: any, keyPath: string): Promise<Ssh2.Client>;
    exec(opt: any): Promise<unknown>;
    scpSend(localPath: string, remotePath: string, opt?: any): Promise<unknown>;
    scpGet(localPath: string, remotePath: string): Promise<unknown>;
    sftpReaddir(path: string): Promise<unknown>;
}
