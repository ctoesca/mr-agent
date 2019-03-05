"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class HttpError extends Error {
    constructor(message, code = 1) {
        super(message);
        this.code = 0;
        this.code = code;
    }
}
exports.HttpError = HttpError;
//# sourceMappingURL=HttpError.js.map