"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tmetric = void 0;
const fs = require("fs");
const os = require("os");
const TbaseMetric_1 = require("../../TbaseMetric");
const Promise = require("bluebird");
class Tmetric extends TbaseMetric_1.default {
    constructor(expressApp, config) {
        super(expressApp, config);
    }
    get() {
        return this.cpu();
    }
    cpu(interval = 5000) {
        let oldMeasure = this.cpuAverage();
        let endMeasure = null;
        return Promise.delay(interval)
            .then((result) => {
            endMeasure = this.cpuAverage();
            let idleDifference = endMeasure.idle - oldMeasure.idle;
            let totalDifference = endMeasure.total - oldMeasure.total;
            let percentageCPU = 100 - (100 * idleDifference / totalDifference);
            percentageCPU = Math.round(percentageCPU * 10) / 10;
            let timeDiff = Math.round((new Date().getTime() - oldMeasure.timestamp) / 1000);
            this.saveCpuMeasure(endMeasure);
            return {
                ellapsed: timeDiff,
                cores: os.cpus().length,
                total: {
                    norm: {
                        pct: percentageCPU
                    }
                }
            };
        });
    }
    format(format, params, result) {
        return result;
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