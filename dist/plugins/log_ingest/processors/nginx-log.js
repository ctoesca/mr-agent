"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TbaseProcessor_1 = require("../TbaseProcessor");
const moment = require("moment");
class Tprocessor extends TbaseProcessor_1.TbaseProcessor {
    constructor(name, opt) {
        super(name, opt);
        this.levels = {
            'debug': 'DEBUG',
            'info': 'INFO',
            'notice': 'INFO',
            'warn': 'WARNING',
            'error': 'ERROR',
            'crit': 'ERROR',
            'alert': 'ERROR',
            'emerg': 'ERROR'
        };
        this.data1RegExp = new RegExp(/[0-9]{4}\/[0-9]{2}\/[0-9]{2}\s[0-9]{2}\:[0-9]{2}\:[0-9]{2}/);
    }
    getMessage(data) {
        return super.getMessage(data)
            .then((message) => {
            let timestampStr = data.message.substr(0, 19);
            if (timestampStr.match(this.data1RegExp)) {
                let timestamp = moment(timestampStr, 'YYYY/MM/DD HH:mm:ss').format();
                if (timestamp === 'Invalid date') {
                    message = false;
                    this.logger.debug('Tprocessor.nginx-log : invalid date (' + timestampStr + ") -> c'est une 'stacktrace' ?");
                }
                else {
                    message['@timestamp'] = timestamp;
                    let level;
                    let levelStart = 20;
                    let parts = data.message.split(' ');
                    level = parts[2].replace('[', '').replace(']', '');
                    message.message = data.message.substr(levelStart + level.length + 3);
                    if (this.levels[level]) {
                        message.level = this.levels[level];
                    }
                    else {
                        message.level = 'INFO';
                        this.logger.debug("Tprocessor.nginx-log : le niveau '" + level + "' ne correspond pas à un niveau connu");
                    }
                }
            }
            else {
                message = false;
                this.logger.debug('Tprocessor.nginx-log : invalid date (' + timestampStr + '): ne correspond pas au filtre regexp');
            }
            return message;
        });
    }
    getIndexName(message) {
        return moment(message['@timestamp']).format('[filebeat-]YYYY.MM.DD');
    }
}
exports.Tprocessor = Tprocessor;
//# sourceMappingURL=nginx-log.js.map