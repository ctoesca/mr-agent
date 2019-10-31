"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TbaseProcessor_1 = require("../TbaseProcessor");
const moment = require("moment");
const HttpAccessParser_js_1 = require("../parsers/HttpAccessParser.js");
const UAParser = require("ua-parser-js");
class Tprocessor extends TbaseProcessor_1.TbaseProcessor {
    constructor(name, opt) {
        super(name, opt);
        if (!this.opt) {
            this.opt = {};
        }
        if (!this.opt.formats) {
            this.opt.formats = {};
        }
        if (this.opt.remoteConfig) {
            this.loadRemoteConfig(this.opt.remoteConfig)
                .then((result) => {
                this.logger.info('Succès récupération de la configuration depuis ' + this.opt.remoteConfig.url);
                this.opt = result;
                this.parseConfig();
            })
                .catch((err) => {
                this.logger.error('Echec récupération de la configuration depuis ' + this.opt.remoteConfig.url + ': ', err);
                this.logger.warn('La configuration locale sera utilisée');
                this.parseConfig();
            });
        }
    }
    parseConfig() {
        if (this.opt.formats) {
            Object.keys(this.opt.formats).forEach((formatName) => {
                this.setParsers(this.opt.formats[formatName]);
            });
        }
        else {
            this.opt.formats = {};
            this.logger.warn('Aucun format dans la configuration du plugin log_ingest/' + this.name);
        }
    }
    createParser(node) {
        let parserClass = HttpAccessParser_js_1.HttpAccessParser;
        if (node.parserClass) {
            parserClass = require('../parsers/' + node.parserClass + '.js')[node.parserClass];
        }
        node.parser = new parserClass(node.masks);
    }
    setParsers(node) {
        if (node.selectors) {
            for (let i = 0; i < node.selectors.length; i++) {
                let selector = node.selectors[i];
                this.setParsers(selector);
            }
        }
        else if (node.masks) {
            this.createParser(node);
        }
    }
    getParser(data) {
        let r = null;
        if (!this.opt.formats[data.format]) {
            throw new Error("format inconnu: '" + data.format + "'");
        }
        let node = this.opt.formats[data.format];
        if (node.parser) {
            r = node.parser;
        }
        else if (node.selectors) {
            for (let i = 0; i < node.selectors.length; i++) {
                let selector = node.selectors[i];
                if (selector.fields) {
                    for (let k in selector.fields) {
                        if (data[k] == selector.fields[k].match) {
                            return selector.parser;
                        }
                    }
                    ;
                }
                else if (selector.parser) {
                    return selector.parser;
                }
            }
        }
        return r;
    }
    createMessage(data) {
        data.message = data.message.replace(/\0/g, '').trim();
        if (data.fields) {
            data.format = data.fields.format;
        }
        let parser = this.getParser(data);
        let message = null;
        if (parser) {
            data.message = data.message.replace(', ', ' ');
            message = parser.parse(data.message);
            if (message === null) {
                throw 'Failed to parse data';
            }
        }
        else {
            throw new Error('Aucun parser pour le message : format=' + data.format + ', message=' + data.message);
        }
        return message;
    }
    getMessage(data) {
        return super.getMessage(data)
            .then((message) => {
            if (message.time_taken) {
                message['time-taken'] = parseInt(message.time_taken, 10);
                message.time_taken = undefined;
            }
            if (message.agent) {
                message.useragent = new UAParser(message.agent).getResult();
                message.agent = undefined;
            }
            if (message.response < 400) {
                message.level = 'INFO';
            }
            else if (message.response < 500) {
                message.level = 'WARNING';
            }
            else {
                message.level = 'ERROR';
            }
            message.message = undefined;
            message.source_message = data.message;
            return message;
        });
    }
    getIndexName(message) {
        return moment(message['@timestamp']).format('[filebeat-]YYYY.MM.DD');
    }
}
exports.Tprocessor = Tprocessor;
//# sourceMappingURL=http-access.js.map