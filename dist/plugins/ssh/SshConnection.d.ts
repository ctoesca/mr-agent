/// <reference types="node" />
import Ssh2 = require('ssh2');
import * as Promise from 'bluebird';
import EventEmitter = require('events');
import bunyan = require('bunyan');
export default class SshConnection extends EventEmitter {
    protected static cachedKeys: Map<string, string>;
    conn: Ssh2.Client;
    protected sshKeysDir: string;
    protected defaultPort: number;
    protected connectTimeout: number;
    protected logger: bunyan;
    constructor(config: any);
    getNewSshClient(): Ssh2.Client;
    close(): void;
    connect(params: any): Promise<Ssh2.Client>;
    findKeyConnection(host: string, port: number, username: string, passphrase: string): Promise<Ssh2.Client>;
    protected getSshKeyCache(host: string, port: number): string;
    protected _connect(params: any): Promise<Ssh2.Client>;
    protected getKeyConnection(host: string, port: number, username: string, keyPath: string, passphrase: string): Promise<Ssh2.Client>;
}
