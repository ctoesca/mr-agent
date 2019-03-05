export declare class SshError extends Error {
    level: any;
    connected: boolean;
    constructor(message: any, level?: any);
    getDetail(): {
        connected: boolean;
        level: any;
    };
}
