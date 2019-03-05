import { Application } from './Application';
import { HttpServer } from './HttpServer';
import express = require('express');
import { TbasePlugin } from './plugins/TbasePlugin';
export declare class WorkerApplication extends Application {
    httpServer: HttpServer;
    protected pluginsInstances: any;
    protected mainApi: express.Application;
    protected startDate: any;
    constructor(configPath: string, opt?: any);
    start(): Promise<any>;
    registerExpressPlugin(mounthPath: string, app: express.Application): void;
    getUrl(): string;
    loadPlugins(): void;
    getPluginInstance(name: string): TbasePlugin;
    stop(): void;
    restart(): void;
    initRoutes(): void;
}
