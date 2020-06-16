"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tplugin = void 0;
const ThttpPlugin_js_1 = require("../ThttpPlugin.js");
require("../../utils/StringTools");
const Errors = require("../../Errors");
const HttpTools_1 = require("../../utils/HttpTools");
const dns = require("dns");
const bodyParser = require("body-parser");
class Tplugin extends ThttpPlugin_js_1.ThttpPlugin {
    constructor(application, config) {
        super(application, config);
        this.ipHash = new Map();
        if (this.config.dnsServers && (this.config.dnsServers.length > 0)) {
            dns.setServers(this.config.dnsServers);
        }
    }
    install() {
        super.install();
        this.app.use(bodyParser.json({
            limit: '500mb'
        }));
        this.app.get('/dnsReverse', this.dnsReverse.bind(this));
    }
    dnsReverse(req, res, next) {
        let params = HttpTools_1.HttpTools.getQueryParams(req, {
            ip: {
                type: 'string'
            }
        });
        if (!this.ipHash.has(params.ip)) {
            dns.reverse(params.ip, (err, hostnames) => {
                let r = {
                    ip: params.ip,
                    hostnames: []
                };
                if (!err) {
                    r.hostnames = hostnames;
                    this.ipHash.set(params.ip, r);
                }
                else if (err.code !== 'ENOTFOUND') {
                    next(new Errors.HttpError(err.toString(), 500));
                    return;
                }
                res.status(200).json(r);
            });
        }
        else {
            res.status(200).json(this.ipHash.get(params.ip));
        }
    }
}
exports.Tplugin = Tplugin;
//# sourceMappingURL=Tplugin.js.map