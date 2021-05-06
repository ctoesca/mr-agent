"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tmetric = void 0;
const utils = require("../../../../utils");
const TbaseMetric_1 = require("../../TbaseMetric");
const si = require("systeminformation");
class Tmetric extends TbaseMetric_1.default {
    constructor(expressApp, config) {
        super(expressApp, config);
    }
    get(args = null) {
        return si.mem()
            .then(result => {
            let r = {
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
            };
            r.swap.used.pct = utils.round(r.swap.used.bytes / r.swap.total, 4);
            r.used.pct = utils.round(r.used.bytes / r.total, 4);
            r.actual.used.pct = utils.round(r.actual.used.bytes / r.total, 4);
            return r;
        });
    }
    format(format, params, result) {
        return result;
    }
}
exports.Tmetric = Tmetric;
//# sourceMappingURL=Tmetric.js.map