"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BadRequest = void 0;
const HttpError_1 = require("./HttpError");
class BadRequest extends HttpError_1.HttpError {
    constructor(message = null, code = 400) {
        if (!message) {
            message = 'Bad Request';
        }
        super(message, code);
    }
}
exports.BadRequest = BadRequest;
//# sourceMappingURL=BadRequest.js.map