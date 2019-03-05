import bunyan = require('bunyan');
export default class TlogToBunyan {
    logger: bunyan;
    constructor();
    error(): void;
    warning(): void;
    info(): void;
    debug(): void;
    trace(method: string, requestUrl: string, body: any, responseBody: any, responseStatus: any): void;
    close(): void;
}
