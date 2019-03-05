"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const HttpError_1 = require("./HttpError");
class Forbidden extends HttpError_1.HttpError {
    constructor(message = null, code = 403) {
        if (!message) {
            message = 'Forbidden';
        }
        super(message, code);
    }
}
exports.Forbidden = Forbidden;
//# sourceMappingURL=Forbidden.js.map