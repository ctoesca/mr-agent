"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TbaseProcessor_1 = require("../TbaseProcessor");
const moment = require("moment");
const dns = require("dns");
class Tprocessor extends TbaseProcessor_1.TbaseProcessor {
    constructor(name, opt) {
        super(name, opt);
        this.ipHash = new Map();
        this.IPmask = /([\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3})/g;
        this.deniedMask = /(Deny|denied)/g;
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
        message.dst_port = null;
        message.src_ip = null;
        message.src_hostname = null;
        message.dst_ip = null;
        message.dst_hostname = null;
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
                    if (!ipHash[ip]) {
                        promises.push(this.dnsReverse(iplist[i]));
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
            message.hostnames = [];
            for (let i = 0; i < results.length; i++) {
                let host = results[i];
                message.hostnames.push(host);
            }
            return message;
        })
            .then((result) => {
            let isDenied = result.message.match(this.deniedMask);
            let hasSourcesDest = (isDenied !== null);
            if (isDenied && (result.level === 'INFO')) {
                result.level = 'WARNING';
            }
            if (result.hostnames.length === 2) {
                if (!hasSourcesDest) {
                    hasSourcesDest = result.message.match(/srcip=[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}.*dstip=[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}/);
                }
                if (hasSourcesDest) {
                    result.src_ip = result.hostnames[0].ip;
                    result.src_hostname = result.hostnames[0].hostname;
                    result.dst_ip = result.hostnames[1].ip;
                    result.dst_hostname = result.hostnames[1].hostname;
                    let dst_port = result.message.match(/dstport=([\d]*)/);
                    if (dst_port) {
                        result.dst_port = dst_port[1];
                    }
                    else {
                        dst_port = result.message.match(new RegExp(result.dst_ip + '.([\\d]+)'));
                        if (dst_port) {
                            result.dst_port = dst_port[1];
                        }
                    }
                }
            }
            result.hostnames = undefined;
            return result;
        });
    }
    getIndexName(message) {
        return moment(message['@timestamp']).format('[rsyslog-]YYYY.MM.DD');
    }
}
exports.Tprocessor = Tprocessor;
//# sourceMappingURL=rsyslog.js.map