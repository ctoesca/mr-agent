/// <reference types="node" />
import EventEmitter = require('events');
import bunyan = require('bunyan');
import express = require('express');
export declare class HttpServer extends EventEmitter {
    config: any;
    auth: any;
    port: number;
    allowedIp: string;
    bindAddress: string;
    httpsOptions: any;
    requestTimeout: number;
    app: express.Application;
    server: any;
    protected mainApi: express.Application;
    protected logger: bunyan;
    constructor(config: any);
    addExpressApplication(mounthPath: string, app: express.Application): void;
    ipIsAllowed(ip: string): boolean;
    setErrorsHandlers(): void;
    authRequest(req: express.Request, res: express.Response, next: express.NextFunction): void;
    getUrl(): string;
    start(): Promise<unknown>;
    protected createServer(): Promise<any>;
    protected listen(): Promise<unknown>;
}
