"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const os = require("os");
const utils = require("../../../../utils");
const TbaseMetric_1 = require("../../TbaseMetric");
const Errors = require("../../../../Errors");
const Promise = require("bluebird");
class Tmetric extends TbaseMetric_1.default {
    constructor(expressApp, config) {
        super(expressApp, config);
    }
    get(args = null) {
        return new Promise((resolve, reject) => {
            let usedMem = os.totalmem() - os.freemem();
            let usedPercent = Math.round(100 * (usedMem / os.totalmem()));
            let r = {
                usedPercent: usedPercent,
                usedMem: usedMem,
                totalMem: os.totalmem()
            };
            resolve(r);
        });
    }
    format(format, params, result) {
        params = utils.parseParams(params, {
            warn: {
                default: 80,
                type: 'integer'
            },
            critic: {
                default: 90,
                type: 'integer'
            }
        });
        if (params.warn > params.critic) {
            throw new Errors.HttpError("'warn' cannot be greater than 'critic' (" + params.critic + ')', 400);
        }
        let state = 'OK';
        let currentState = 0;
        if (result.usedPercent >= params.warn) {
            currentState = 1;
            state = 'WARNING';
        }
        if (result.usedPercent >= params.critic) {
            currentState = 2;
            state = 'CRITIC';
        }
        let output = state + ' - Mémoire physique utilisée : ' + result.usedPercent + '% (' + this.convertBytesToGo(result.usedMem) + 'Go utilisés sur un total de ' + this.convertBytesToGo(result.totalMem) + 'Go)';
        let perfdata = "'Physical Memory Used'=" + result.usedMem + "Bytes; 'Physical Memory Utilisation'=" + result.usedPercent + '%;' + params.warn + ';' + params.critic;
        return currentState + '|' + output + '|' + perfdata;
    }
}
exports.Tmetric = Tmetric;
//# sourceMappingURL=Tmetric.js.map