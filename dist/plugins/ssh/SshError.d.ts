export declare class SshError extends Error {
    level: any;
    connected: boolean;
    connectionID: string;
    constructor(message: any, level?: any);
    getDetail(): {
        connected: boolean;
        level: any;
        connectionID: string;
    };
}
