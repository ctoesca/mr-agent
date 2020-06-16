"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tmetric = void 0;
const utils = require("../../../../utils");
const TbaseMetric_1 = require("../../TbaseMetric");
const Errors = require("../../../../Errors");
const si = require("systeminformation");
class Tmetric extends TbaseMetric_1.default {
    constructor(expressApp, config) {
        super(expressApp, config);
    }
    get(args = null) {
        return si.mem()
            .then(result => {
            let r = {
                memory: {
                    free: result.free,
                    total: result.total,
                    actual: {
                        free: result.available,
                        used: {
                            'pct': null,
                            'bytes': result.active
                        }
                    },
                    swap: {
                        total: result.swaptotal,
                        used: {
                            pct: null,
                            bytes: result.swapused
                        },
                        free: result.swapfree
                    },
                    used: {
                        bytes: result.used,
                        pct: null
                    }
                }
            };
            r.memory.swap.used.pct = utils.round(r.memory.swap.used.bytes / r.memory.swap.total, 4);
            r.memory.used.pct = utils.round(r.memory.used.bytes / r.total, 4);
            r.memory.actual.used.pct = utils.round(r.memory.actual.used.bytes / r.total, 4);
            return r;
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