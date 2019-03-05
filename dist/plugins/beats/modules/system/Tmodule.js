"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TbaseModule_1 = require("../../TbaseModule");
const utils = require("../../../../utils");
const os = require("os");
const si = require("systeminformation");
class Tmodule extends TbaseModule_1.default {
    constructor(config) {
        super(config);
        this.oldCpus = null;
    }
    processes() {
        si.processes()
            .then((results) => {
            for (let item of results.list) {
                if (item.name.contains('chrome.exe') && (item.pcpu > 1)) {
                    this.logger.error(item);
                }
            }
        });
    }
    memory() {
        if (this.config.data.metricsets.indexOf('memory') >= 0) {
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
                this.emit('metric', this, this.getMetricset('memory'), r);
            });
        }
    }
    load() {
        if (this.config.data.metricsets.indexOf('load') >= 0) {
            let load = os.loadavg();
            let cores = os.cpus().length;
            let r = {
                load: {
                    '1': utils.round(load[0], 2),
                    '5': utils.round(load[1], 2),
                    '15': utils.round(load[2], 2),
                    norm: {
                        '1': utils.round(load[0] / cores, 3),
                        '5': utils.round(load[1] / cores, 3),
                        '15': utils.round(load[2] / cores, 3)
                    },
                    cores: cores
                }
            };
            this.emit('metric', this, this.getMetricset('load'), r);
        }
    }
    cpu() {
        if (this.config.data.metricsets.indexOf('cpu') >= 0) {
            return this.getOldCpus()
                .then(startCpus => {
                let endCpus = this.getCpus();
                this.oldCpus = endCpus;
                let r = {
                    cpu: {
                        cores: endCpus.length,
                        total: {
                            pct: 0,
                            norm: {
                                pct: null
                            }
                        }
                    }
                };
                for (let i = 0, len = endCpus.length; i < len; i++) {
                    let startCpu = startCpus[i];
                    let endCpu = endCpus[i];
                    let totalTicks = 0;
                    Object.keys(endCpu.times).forEach((k) => {
                        totalTicks += endCpu.times[k] - startCpu.times[k];
                    });
                    Object.keys(endCpu.times).forEach((k) => {
                        let fieldName = k;
                        if (k === 'sys') {
                            fieldName = 'system';
                        }
                        let pct = ((endCpu.times[k] - startCpu.times[k]) / totalTicks);
                        if (typeof r[fieldName] === 'undefined') {
                            r.cpu[fieldName] = {
                                pct: 0,
                                norm: {
                                    pct: null
                                }
                            };
                        }
                        r.cpu[fieldName].pct += pct;
                        if ((k !== 'idle') && (k !== 'iowait')) {
                            r.cpu.total.pct += pct;
                        }
                    });
                }
                let fields = ['total', 'user', 'nice', 'system', 'idle', 'irq', 'iowait', 'softirq', 'steal'];
                for (let k of fields) {
                    if ((typeof r.cpu[k] !== 'undefined')) {
                        r.cpu[k].norm.pct = utils.round(r.cpu[k].pct / endCpus.length, 3);
                        r.cpu[k].pct = utils.round(r.cpu[k].pct, 3);
                    }
                }
                this.emit('metric', this, this.getMetricset('cpu'), r);
            });
        }
    }
    getMetricset(metricName) {
        return {
            name: metricName,
            module: this.name
        };
    }
    getOldCpus() {
        let r = this.oldCpus;
        if (!r) {
            return new Promise((resolve) => {
                r = this.getCpus();
                setTimeout(() => {
                    resolve(r);
                }, 2000);
            });
        }
        else {
            return Promise.resolve(r);
        }
    }
    getCpus() {
        let cpus = os.cpus();
        return cpus;
    }
    onTimer() {
        this.cpu()
            .then(r => {
            this.load();
        })
            .then(r => {
            this.memory();
        });
    }
}
exports.default = Tmodule;
//# sourceMappingURL=Tmodule.js.map