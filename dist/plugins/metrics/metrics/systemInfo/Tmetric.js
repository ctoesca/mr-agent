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
        let hh = Math.round(result.uptime / 3600);
        let jj = Math.round(hh / 24);
        let uptime = '';
        if (jj >= 1) {
            uptime += jj + ' jour';
        }
        if (jj >= 2) {
            uptime += 's';
        }
        if (uptime !== '') {
            uptime += ' ';
        }
        if (hh <= 1) {
            uptime += hh + ' heure';
        }
        else {
            uptime += hh + ' heures';
        }
        return '0|' + result.hostname + ': ' + result.osType + '/' + result.release + ', démarré il y a ' + uptime;
    }
}
exports.Tmetric = Tmetric;
//# sourceMappingURL=Tmetric.js.map