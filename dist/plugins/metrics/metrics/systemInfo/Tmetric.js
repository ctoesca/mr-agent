"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tmetric = void 0;
const os = require("os");
const TbaseMetric_1 = require("../../TbaseMetric");
const Promise = require("bluebird");
class Tmetric extends TbaseMetric_1.default {
    constructor(expressApp, config) {
        super(expressApp, config);
    }
    get(args = null) {
        return new Promise(resolve => {
            let r = {
                userInfo: os.userInfo(),
                uptime: os.uptime(),
                osType: os.type(),
                release: os.release(),
                platform: os.platform(),
                hostname: os.hostname()
            };
            resolve(r);
        });
    }
    format(format, params, result) {
        return result;
    }
}
exports.Tmetric = Tmetric;
//# sourceMappingURL=Tmetric.js.map