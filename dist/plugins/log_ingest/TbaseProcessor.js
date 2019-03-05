"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Application_1 = require("../../Application");
const EventEmitter = require("events");
const request = require("request");
class TbaseProcessor extends EventEmitter {
    constructor(name, opt) {
        super();
        this.name = null;
        this.opt = null;
        this.logger = null;
        this.name = name;
        this.opt = opt;
        this.logger = Application_1.Application.getLogger(this.name);
        this.logger.info('Processor ' + name + ' created. ');
    }
    createMessage(data) {
        let message = {};
        return message;
    }
    loadRemoteConfig(data) {
        return new Promise((resolve, reject) => {
            let options = {
                url: data.url,
                strictSSL: false,
                json: true,
                method: 'GET'
            };
            if (data.auth) {
                options.auth = data.auth;
            }
            request(options, (err, response, body) => {
                if (!err && (response.statusCode >= 400)) {
                    err = body;
                }
                if (err) {
                    reject(err);
                }
                else {
                    resolve(body);
                }
            });
        });
    }
    setCommonProperties(data, message) {
        if (data.fields) {
            Object.keys(data.fields).forEach((k) => {
                message[k] = data.fields[k];
            });
        }
        else {
            if (data.origin) {
                message.origin = data.origin;
            }
            if (data.env) {
                message.env = data.env;
            }
        }
        message.type = data.type;
        if (data.host) {
            message.host = data.host;
        }
        else {
            if (data.beat) {
                message.host = data.beat.hostname;
            }
        }
        if (data.source) {
            message.source = data.source;
        }
        message._indexName = this.getIndexName(message);
        message.beat = undefined;
        return message;
    }
    getMessage(data) {
        try {
            let message = this.createMessage(data);
            this.setCommonProperties(data, message);
            return Promise.resolve(message);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    getIndexName(message) {
        throw 'getIndexName is not implemented';
    }
}
exports.TbaseProcessor = TbaseProcessor;
//# sourceMappingURL=TbaseProcessor.js.map