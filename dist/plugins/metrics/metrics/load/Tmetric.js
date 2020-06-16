"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tmetric = void 0;
const os = require("os");
const TbaseMetric_1 = require("../../TbaseMetric");
const utils = require("../../../../utils");
const Errors = require("../../../../Errors");
const Promise = require("bluebird");
class Tmetric extends TbaseMetric_1.default {
    constructor(expressApp, config) {
        super(expressApp, config);
        this.defaultWarn = 8;
        this.defaultCritic = 15;
    }
    get(args = null) {
        return new Promise((resolve, reject) => {
            try {
                let load = os.loadavg();
                let r = {
                    load1: load[0],
                    load5: load[1],
                    load15: load[2]
                };
                resolve(r);
            }
            catch (err) {
                reject(err);
            }
        });
    }
    format(format, params, result) {
        let defaultParams = utils.parseParams(params, {
            warn: {
                default: this.defaultWarn,
                type: 'integer'
            },
            critic: {
                default: this.defaultCritic,
                type: 'integer'
            }
        });
        if (defaultParams.warn > defaultParams.critic) {
            throw new Errors.HttpError("'warn' cannot be greater than 'critic' (" + defaultParams.critic + ')', 400);
        }
        params = utils.parseParams(params, {
            warn1: {
                default: defaultParams.warn,
                type: 'integer'
            },
            warn5: {
                default: defaultParams.warn,
                type: 'integer'
            },
            warn15: {
                default: defaultParams.warn,
                type: 'integer'
            },
            critic1: {
                default: defaultParams.critic,
                type: 'integer'
            },
            critic5: {
                default: defaultParams.critic,
                type: 'integer'
            },
            critic15: {
                default: defaultParams.critic,
                type: 'integer'
            }
        });
        if (params.warn1 > params.critic1) {
            throw new Errors.HttpError("'warn1' cannot be greater than 'critic1' (" + params.critic1 + ')', 400);
        }
        if (params.warn5 > params.critic5) {
            throw new Errors.HttpError("'warn5' cannot be greater than 'critic5' (" + params.critic5 + ')', 400);
        }
        if (params.warn15 > params.critic15) {
            throw new Errors.HttpError("'warn15' cannot be greater than 'critic15' (" + params.critic15 + ')', 400);
        }
        let currentState = 0;
        if ((result.load15 >= params.critic15) || (result.load5 >= params.critic5) || (result.load1 >= params.critic1)) {
            currentState = 2;
        }
        else if ((result.load15 >= params.warn15) || (result.load5 >= params.warn5) || (result.load1 >= params.warn1)) {
            currentState = 1;
        }
        let state = 'OK';
        if (currentState === 1) {
            state = 'WARNING';
        }
        else if (currentState === 2) {
            state = 'CRITIC';
        }
        let output = state + ' - load average: ' + result.load1 + ', ' + result.load5 + ', ' + result.load15;
        let perfdata = 'load1=' + result.load1 + ';' + params.warn1 + ';' + params.critic1 + ';0; ';
        perfdata += 'load5=' + result.load5 + ';' + params.warn5 + ';' + params.critic5 + ';0; ';
        perfdata += 'load15' + result.load15 + ';' + params.warn15 + ';' + params.critic15 + ';0; ';
        return currentState + '|' + output + '|' + perfdata;
    }
}
exports.Tmetric = Tmetric;
//# sourceMappingURL=Tmetric.js.map