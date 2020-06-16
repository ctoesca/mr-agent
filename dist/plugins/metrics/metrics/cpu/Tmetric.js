"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tmetric = void 0;
const fs = require("fs");
const os = require("os");
const TbaseMetric_1 = require("../../TbaseMetric");
const utils = require("../../../../utils");
const Errors = require("../../../../Errors");
const Promise = require("bluebird");
class Tmetric extends TbaseMetric_1.default {
    constructor(expressApp, config) {
        super(expressApp, config);
    }
    get() {
        return this.cpu();
    }
    cpuFromLastMeasure() {
        return this.getOldCpuMeasure()
            .then((oldMeasure) => {
            let startMeasure = oldMeasure;
            let endMeasure = this.cpuAverage();
            let r = this.calc(startMeasure, endMeasure);
            this.saveCpuMeasure(endMeasure);
            return r;
        });
    }
    calc(startMeasure, endMeasure) {
        let idleDifference = endMeasure.idle - startMeasure.idle;
        let totalDifference = endMeasure.total - startMeasure.total;
        let percentageCPU = 100 - ~~(100 * idleDifference / totalDifference);
        let timeDiff = Math.round((new Date().getTime() - startMeasure.timestamp) / 1000);
        let r = { ellapsed: timeDiff, percentageCPU: percentageCPU };
        return r;
    }
    cpu(interval = 5000) {
        let oldMeasure = this.cpuAverage();
        let endMeasure = null;
        return Promise.delay(interval)
            .then((result) => {
            endMeasure = this.cpuAverage();
            let idleDifference = endMeasure.idle - oldMeasure.idle;
            let totalDifference = endMeasure.total - oldMeasure.total;
            let percentageCPU = 100 - ~~(100 * idleDifference / totalDifference);
            let timeDiff = Math.round((new Date().getTime() - oldMeasure.timestamp) / 1000);
            this.saveCpuMeasure(endMeasure);
            return { ellapsed: timeDiff, percentageCPU: percentageCPU };
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
        let state = 'OK';
        let currentState = 0;
        if (params.warn > params.critic) {
            throw new Errors.HttpError("'warn' cannot be greater than 'critic' (" + params.critic + ')', 400);
        }
        if (params.warn !== null) {
            if (result.percentageCPU >= params.warn) {
                state = 'WARNING';
                currentState = 1;
            }
        }
        if (params.critic !== null) {
            if (result.percentageCPU >= params.critic) {
                state = 'CRITIC';
                currentState = 2;
            }
        }
        let output = state + ' (Sample Period ' + result.ellapsed + ' sec) - Average CPU Utilisation ' + result.percentageCPU + '%';
        let perfdata = "'Avg CPU Utilisation'=" + result.percentageCPU + '%;' + params.warn + ';' + params.critic + ';';
        return currentState + '|' + output + '|' + perfdata;
    }
    cpuAverage() {
        let totalIdle = 0, totalTick = 0;
        let cpus = os.cpus();
        for (let i = 0, len = cpus.length; i < len; i++) {
            let cpu = cpus[i];
            Object.keys(cpu.times).forEach((type) => {
                totalTick += cpu.times[type];
            });
            totalIdle += cpu.times.idle;
        }
        return { timestamp: new Date().getTime(), idle: totalIdle / cpus.length, total: totalTick / cpus.length };
    }
    getOldCpuMeasure() {
        let startMeasure = null;
        let dataPath = this.config.tmpDir + '/cpu.json';
        if (fs.existsSync(dataPath)) {
            try {
                let data = fs.readFileSync(dataPath);
                data = JSON.parse(data.toString());
                startMeasure = data;
            }
            catch (err) {
                this.logger.warn('Error reading file ' + dataPath + ': ' + err.toString());
            }
        }
        if (!startMeasure) {
            return new Promise((resolve) => {
                startMeasure = this.cpuAverage();
                setTimeout(() => {
                    resolve(startMeasure);
                }, 2000);
            });
        }
        else {
            return Promise.resolve(startMeasure);
        }
    }
    saveCpuMeasure(measure) {
        let dataPath = this.config.tmpDir + '/cpu.json';
        fs.writeFileSync(dataPath, JSON.stringify(measure));
    }
}
exports.Tmetric = Tmetric;
//# sourceMappingURL=Tmetric.js.map