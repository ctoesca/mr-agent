"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TbaseParser = void 0;
const EventEmitter = require("events");
const Application_1 = require("../../../Application");
class TbaseParser extends EventEmitter {
    constructor() {
        super();
        this.logger = null;
        this.logger = Application_1.Application.getLogger(this.constructor.name);
    }
    parse(line) {
        throw 'TbaseParser.parse() is abstract';
    }
    escape(str) {
        return str.replace(new RegExp('[.*+?|()\\[\\]{}]', 'g'), '\\$&');
    }
}
exports.TbaseParser = TbaseParser;
//# sourceMappingURL=TbaseParser.js.map