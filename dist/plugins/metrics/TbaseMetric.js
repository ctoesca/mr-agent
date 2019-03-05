"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const url = require("url");
const fs = require("fs-extra");
const WorkerApplication_1 = require("../../WorkerApplication");
const Promise = require("bluebird");
class TbaseMetric {
    constructor(expressApp, config) {
        this.name = null;
        this.app = null;
        this.config = null;
        this.app = expressApp;
        this.config = config;
        this.name = config.name;
        this.application = config.application;
        this.logger = WorkerApplication_1.WorkerApplication.getLogger(this.constructor.name + '.' + this.name);
        fs.ensureDir(this.config.tmpDir);
        this.app.get('/', this.getRequest.bind(this));
    }
    format(format, params, result) {
        return '0|OK';
    }
    getInfos() {
        return {
            name: this.name,
            url: this.app.path(),
            args: []
        };
    }
    getRequest(req, res, next) {
        let u = url.parse(req.url, true);
        let isForNagios = (u.query.format === 'nagios');
        this.get(u.query)
            .then(r => {
            if (isForNagios) {
                res.contentType('text/plain');
                res.send(this.format('nagios', u.query, r));
            }
            else {
                res.json(r);
            }
        })
            .catch((err) => {
            if (isForNagios) {
                res.contentType('text/plain');
                res.send('3|' + err.toString());
            }
            else {
                next(err);
            }
        });
    }
    convertBytesToGo(v) {
        if (v < 1024 * 1024 * 10) {
            return Math.round(1000 * v / 1024 / 1024 / 1024) / 1000;
        }
        else if (v < 1024 * 1024 * 100) {
            return Math.round(100 * v / 1024 / 1024 / 1024) / 100;
        }
        else {
            return Math.round(10 * v / 1024 / 1024 / 1024) / 10;
        }
    }
    get(args = null) {
        return Promise.resolve({});
    }
}
exports.default = TbaseMetric;
//# sourceMappingURL=TbaseMetric.js.map