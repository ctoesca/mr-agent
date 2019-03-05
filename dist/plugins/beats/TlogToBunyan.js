"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bunyan = require("bunyan");
class TlogToBunyan {
    constructor() {
        this.logger = null;
        this.logger = bunyan.createLogger({ name: 'beats.elasticsearch' });
    }
    error() {
        this.logger.error.apply(this.logger, arguments);
    }
    warning() {
        this.logger.warn.apply(this.logger, arguments);
    }
    info() {
        this.logger.info.apply(this.logger, arguments);
    }
    debug() {
        this.logger.debug.apply(this.logger, arguments);
    }
    trace(method, requestUrl, body, responseBody, responseStatus) {
        this.logger.trace({
            method: method,
            requestUrl: requestUrl,
            body: body,
            responseBody: responseBody,
            responseStatus: responseStatus
        });
    }
    close() {
    }
}
exports.default = TlogToBunyan;
//# sourceMappingURL=TlogToBunyan.js.map