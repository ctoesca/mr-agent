"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tprocessor = void 0;
const TbaseProcessor_1 = require("../TbaseProcessor");
const moment = require("moment");
const UAParser = require("ua-parser-js");
class Tprocessor extends TbaseProcessor_1.TbaseProcessor {
    constructor(name, opt) {
        super(name, opt);
    }
    createMessage(data) {
        let message = JSON.parse(data.message);
        return message;
    }
    getMessage(data) {
        return super.getMessage(data)
            .then((message) => {
            if (message.agent) {
                message.useragent = new UAParser(message.agent).getResult();
                message.agent = undefined;
            }
            if (message.response >= 400) {
                message.level = 'WARNING';
            }
            if (message.response >= 500) {
                message.level = 'ERROR';
            }
            return message;
        });
    }
    getIndexName(message) {
        return moment(message['@timestamp']).format('[filebeat-]YYYY.MM.DD');
    }
}
exports.Tprocessor = Tprocessor;
//# sourceMappingURL=app-ctop.js.map