"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tprocessor = void 0;
const TbaseProcessor_1 = require("../TbaseProcessor");
const moment = require("moment");
class Tprocessor extends TbaseProcessor_1.TbaseProcessor {
    constructor(name, opt) {
        super(name, opt);
        this.levels = {
            'Erreur': 'ERROR',
            'Information': 'INFO',
            'Avertissement': 'WARNING',
            'Critique': 'CRITICAL'
        };
    }
    createMessage(data) {
        return data;
    }
    getMessage(data) {
        return super.getMessage(data)
            .then((message) => {
            message.original_level = message.level;
            message.level = this.levels[message.level];
            if (!message.message) {
                message.level = 'WARNING';
                message.message = '<AUCUN MESSAGE>';
            }
            message.host = message.computer_name;
            message.origin = message.log_name;
            return message;
        });
    }
    getIndexName(message) {
        return moment(message['@timestamp']).format('[winlogbeat-]YYYY.MM.DD');
    }
}
exports.Tprocessor = Tprocessor;
//# sourceMappingURL=wineventlog.js.map