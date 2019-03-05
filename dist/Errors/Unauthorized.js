"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const HttpError_1 = require("./HttpError");
class Unauthorized extends HttpError_1.HttpError {
    constructor(message = null, code = 401) {
        if (!message) {
            message = 'Unauthorized';
        }
        super(message, code);
    }
}
exports.Unauthorized = Unauthorized;
//# sourceMappingURL=Unauthorized.js.map