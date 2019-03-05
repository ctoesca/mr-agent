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
        this.data1RegExp = new RegExp(/[a-zA-Z]{3}\s[a-zA-Z]{3}\s[0-9]{2}\s[0-9]{2}\:[0-9]{2}\:[0-9]{2}\.[0-9]{6}\s[0-9]{4}/);
    }
    getMessage(data) {
        return super.getMessage(data)
            .then((message) => {
            let timestampStr = data.message.substr(0, 33).replace('[', '').replace(']', '');
            if (timestampStr.match(this.data1RegExp)) {
                let timestamp = moment(timestampStr, 'ddd MMM DD HH:mm:SS.SSSSSS YYYY').format();
                if (timestamp === 'Invalid date') {
                    message = false;
                    this.logger.debug('Tprocessor.apache-log : invalid date (' + timestampStr + ') ?');
                }
                else {
                    message['@timestamp'] = timestamp;
                    let level;
                    let levelStart = 34;
                    message.message = data.message.substr(levelStart).replace(/\\\\n/g, '\n');
                    let parts = message.message.split(' ');
                    level = parts[0].split(':')[1].replace(']', '');
                    if (this.levels[level]) {
                        message.level = this.levels[level];
                    }
                    else {
                        message.level = 'INFO';
                        this.logger.debug("Tprocessor.apache-log : le niveau '" + level + "' ne correspond pas à un niveau connu");
                    }
                }
            }
            else {
                message = false;
                this.logger.debug('Tprocessor.apache-log : invalid date (' + timestampStr + '): ne correspond pas au filtre regexp');
            }
            return message;
        });
    }
    getIndexName(message) {
        return moment(message['@timestamp']).format('[filebeat-]YYYY.MM.DD');
    }
}
exports.Tprocessor = Tprocessor;
//# sourceMappingURL=apache-log.js.map