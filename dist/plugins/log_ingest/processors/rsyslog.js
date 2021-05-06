"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tprocessor = void 0;
const TbaseProcessor_1 = require("../TbaseProcessor");
const moment = require("moment");
const dns = require("dns");
class Tprocessor extends TbaseProcessor_1.TbaseProcessor {
    constructor(name, opt) {
        super(name, opt);
        this.ipHash = new Map();
        this.IPmask = /([\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3})/g;
        this.levels = {
            'debug': 'DEBUG',
            'info': 'INFO',
            'notice': 'INFO',
            'warning': 'WARNING',
            'warn': 'WARNING',
            'error': 'ERROR',
            'err': 'ERROR',
            'crit': 'ERROR',
            'alert': 'ERROR',
            'emerg': 'ERROR'
        };
        if (this.opt && this.opt.dnsServers) {
            dns.setServers(this.opt.dnsServers);
        }
    }
    createMessage(data) {
        let message = JSON.parse(data.message);
        return message;
    }
    dnsReverse(ip) {
        if (!this.ipHash.has(ip)) {
            let ipData = {
                ip: ip,
                hostname: null
            };
            return new Promise((resolve) => {
                dns.reverse(ip, (err, hostnames) => {
                    if (!err) {
                        if (hostnames.length > 0) {
                            ipData.hostname = hostnames[0];
                        }
                    }
                    this.ipHash.set(ip, ipData);
                    resolve(ipData);
                });
            });
        }
        else {
            return Promise.resolve(this.ipHash.get(ip));
        }
    }
    isValidIp(ip) {
        let r = true;
        let parts = ip.split('.');
        for (let part of parts) {
            let ipPart = parseInt(part);
            if (ipPart > 255) {
                r = false;
                break;
            }
        }
        return r;
    }
    getMessage(data) {
        let message;
        return super.getMessage(data)
            .then((result) => {
            message = result;
            message.original_level = message.severity;
            if (this.levels[message.severity]) {
                message.level = this.levels[message.severity];
            }
            message.origin = message.sysloghost;
            message.severity = undefined;
            message['@version'] = undefined;
            let iplist = message.message.match(this.IPmask);
            if (iplist !== null) {
                let promises = [];
                let ipHash = {};
                for (let i = 0; i < iplist.length; i++) {
                    let ip = iplist[i];
                    if (!ipHash[ip] && this.isValidIp(ip)) {
                        promises.push(this.dnsReverse(ip));
                    }
                    ipHash[ip] = ip;
                }
                return Promise.all(promises);
            }
            else {
                return [];
            }
        })
            .then((results) => {
            message.hostnames = results;
            return message;
        });
    }
    getIndexName(message) {
        return moment(message['@timestamp']).format('[rsyslog-]YYYY.MM.DD');
    }
}
exports.Tprocessor = Tprocessor;
//# sourceMappingURL=rsyslog.js.map