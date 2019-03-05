"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TbaseModule_1 = require("../../TbaseModule");
const request = require("request-promise");
class Tmodule extends TbaseModule_1.default {
    constructor(config) {
        super(config);
        this.path = '/jolokia';
        this.mbeans = config.data['jmx.mappings'];
        if (this.config.data.path) {
            this.path = this.config.data.path;
        }
        if (this.config.data.namespace) {
            this.namespace = this.config.data.namespace;
        }
    }
    onTimer() {
        for (let host of this.config.data.hosts) {
            if (this.mbeans.length > 0) {
                let body = [];
                for (let mbean of this.mbeans) {
                    body.push({
                        'type': 'read',
                        'mbean': mbean.mbean,
                        'attribute': mbean.attribute
                    });
                }
                this.getMbeans(host, body)
                    .then((result) => {
                    let r = {};
                    r[this.namespace] = {};
                    let sendResult = false;
                    for (let i = 0; i < result.responses.length; i++) {
                        let item = result.responses[i];
                        if (item.error) {
                            this.logger.error(item.error);
                            this.emit('error', this, this.getMetricset('jmx', host), item.error);
                        }
                        else {
                            let mbean = this.mbeans[i];
                            for (let attribute of mbean.attributes) {
                                this.setValue(r[this.namespace], attribute.field, item.value[attribute.attr]);
                                sendResult = true;
                            }
                        }
                    }
                    if (sendResult) {
                        this.emit('metric', this, this.getMetricset('jmx', host), r);
                    }
                })
                    .catch(err => {
                    this.emit('error', this, this.getMetricset('jmx', host), err.toString());
                    this.logger.error(err);
                });
            }
        }
    }
    setValue(obj, path, value) {
        let properties = path.split('.');
        let current = obj;
        for (let j = 0; j < properties.length; j++) {
            let propName = properties[j];
            if (j < properties.length - 1) {
                if (typeof current[propName] === 'undefined') {
                    current[propName] = {};
                }
            }
            else {
                current[propName] = value;
            }
            current = current[propName];
        }
    }
    getMbeans(host, body) {
        let url = null;
        if (host.startsWith('http')) {
            url = host + this.path;
        }
        else {
            url = 'http://' + host + this.path;
        }
        let opt = {
            method: 'POST',
            url: url,
            body: body,
            json: true
        };
        return request(opt)
            .then((resp) => {
            let r = {
                host: host,
                responses: resp
            };
            return r;
        })
            .catch(err => {
            throw new Error(opt.method + ' ' + opt.url + ': ' + err.toString());
        });
    }
    getMetricset(metricName, host) {
        return {
            name: metricName,
            module: this.name,
            namespace: this.name + '.' + this.namespace,
            host: host
        };
    }
}
exports.default = Tmodule;
//# sourceMappingURL=Tmodule.js.map