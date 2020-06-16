"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpError = void 0;
class HttpError extends Error {
    constructor(message, code = 500) {
        super(message);
        this.code = 0;
        this.code = code;
    }
}
exports.HttpError = HttpError;
//# sourceMappingURL=HttpError.js.map