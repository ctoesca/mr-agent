/// <reference types="node" />
import EventEmitter = require('events');
import bunyan = require('bunyan');
export interface ApplicationConstructor {
    new (configPath: string, opt: any): Application;
}
export declare class Application extends EventEmitter {
    static version: string;
    static applicationDirPath: string;
    private static _instance;
    config: any;
    serviceName: string;
    protected logsConfig: any;
    protected _loggers: Map<string, bunyan>;
    protected logger: bunyan;
    protected configPath: string;
    protected rotator: any;
    constructor(configPath: string, opt?: any);
    static create(clazz: ApplicationConstructor, configPath: string, opt?: any): Application;
    static getInstance(): Application;
    static getLogger(name?: string): bunyan;
    static getConfigDir(): string;
    start(): Promise<any>;
    getTmpDir(): any;
    getLogger(name?: string): bunyan;
    getDefaultLogConfig(): {
        'http-access-log': {
            enabled: boolean;
            'log-name': string;
            'log-dir': string;
            options: {
                size: string;
                maxFiles: number;
            };
        };
        logger: {
            level: string;
            streams: ({
                stream: NodeJS.WriteStream;
                type?: undefined;
                path?: undefined;
                schedule?: undefined;
                size?: undefined;
                compress?: undefined;
                count?: undefined;
            } | {
                type: string;
                path: string;
                schedule: string;
                size: string;
                compress: boolean;
                count: number;
                stream?: undefined;
            })[];
        };
    };
    getLogsConfig(): any;
}
