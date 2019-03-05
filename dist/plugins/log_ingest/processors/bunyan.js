"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TbaseProcessor_1 = require("../TbaseProcessor");
const moment = require("moment");
class Tprocessor extends TbaseProcessor_1.TbaseProcessor {
    constructor(name, opt) {
        super(name, opt);
        this.levels = {
            10: 'TRACE',
            20: 'DEBUG',
            30: 'INFO',
            40: 'WARNING',
            50: 'ERROR',
            60: 'CRITICAL'
        };
    }
    createMessage(data) {
        let message = JSON.parse(data.message);
        return message;
    }
    getMessage(data) {
        return super.getMessage(data)
            .then((message) => {
            message.host = message.hostname;
            message.hostname = undefined;
            message.level = this.levels[message.level];
            message.message = '[' + message.name + '] ' + message.msg;
            message.source_name = message.name;
            message.msg = undefined;
            message['@timestamp'] = moment(message.time).format('YYYY-MM-DDTHH:mm:ss.SSSZZ');
            message.logger = message.name;
            message.name = undefined;
            message.time = undefined;
            message.v = undefined;
            return message;
        });
    }
    getIndexName(message) {
        return moment(message['@timestamp']).format('[filebeat-]YYYY.MM.DD');
    }
}
exports.Tprocessor = Tprocessor;
//# sourceMappingURL=bunyan.js.map