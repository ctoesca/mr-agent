"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tprocessor = void 0;
const TbaseProcessor_1 = require("../TbaseProcessor");
const moment = require("moment");
class Tprocessor extends TbaseProcessor_1.TbaseProcessor {
    constructor(name, opt) {
        super(name, opt);
        this.levels = {
            'DEBUG': 'DEBUG',
            'ERROR': 'ERROR',
            'FATAL': 'ERROR',
            'INFO': 'INFO',
            'TRACE': 'DEBUG',
            'WARN': 'WARNING'
        };
        this.data1RegExp = new RegExp(/[0-9]{4}\-[0-9]{2}\-[0-9]{2}\s[0-9]{2}\:[0-9]{2}\:[0-9]{2}/);
    }
    getMessage(data) {
        return super.getMessage(data)
            .then((message) => {
            let timestampStr = data.message.substr(0, 19);
            timestampStr = timestampStr.replace(/\//g, '-');
            if (timestampStr.match(this.data1RegExp)) {
                let timestamp = moment(timestampStr, 'YYYY-MM-DD HH:mm:ss').format();
                if (timestamp === 'Invalid date') {
                    this.logger.debug('Tprocessor.java : invalid date (' + timestampStr + ") -> c'est une 'stacktrace' ?");
                    message = false;
                }
                else {
                    message['@timestamp'] = timestamp;
                    let level;
                    let format = 1;
                    let levelStart = 24;
                    let char19 = data.message.substr(19, 1);
                    if (char19 === ' ') {
                        levelStart = 20;
                    }
                    if (data.message.substr(levelStart, 1) === '[') {
                        format = 2;
                    }
                    let parts = data.message.split(' ');
                    if (format === 1) {
                        message.message = data.message.substr(levelStart + 6);
                        level = parts[2];
                    }
                    else {
                        message.message = data.message.substr(levelStart + 8);
                        level = parts[2].replace('[', '').replace(']', '');
                    }
                    if (this.levels[level]) {
                        message.level = this.levels[level];
                    }
                    else {
                        message.level = 'INFO';
                        this.logger.debug("Tprocessor.java : le niveau '" + level + "' ne correspond pas à un niveau connu");
                    }
                }
            }
            else {
                message = false;
                this.logger.debug('Tprocessor.java : invalid date (' + timestampStr + ')');
            }
            return message;
        });
    }
    getIndexName(message) {
        return moment(message['@timestamp']).format('[filebeat-]YYYY.MM.DD');
    }
}
exports.Tprocessor = Tprocessor;
//# sourceMappingURL=java.js.map