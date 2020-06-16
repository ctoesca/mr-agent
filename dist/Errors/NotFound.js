"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFound = void 0;
const HttpError_1 = require("./HttpError");
class NotFound extends HttpError_1.HttpError {
    constructor(message = null, code = 404) {
        if (!message) {
            message = 'Not Found';
        }
        super(message, code);
    }
}
exports.NotFound = NotFound;
//# sourceMappingURL=NotFound.js.map