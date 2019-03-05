"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process = require("child_process");
const TbaseMetric_1 = require("../../TbaseMetric");
const utils = require("../../../../utils");
const Errors = require("../../../../Errors");
const Promise = require("bluebird");
class Tmetric extends TbaseMetric_1.default {
    constructor(expressApp, config) {
        super(expressApp, config);
    }
    getInfos() {
        let r = super.getInfos();
        r.args.push({
            name: 'fs',
            required: false,
            description: 'comma separated disks or filesystems.\nWindows example: fs=C,D\nLinux example: fs=/tmp,/'
        });
        return r;
    }
    get(args = null) {
        let disksParams = null;
        if (args && args.fs) {
            disksParams = args.fs;
            if (disksParams === '') {
                disksParams = null;
            }
        }
        let disks = null;
        if (disksParams) {
            disks = disksParams.split(',');
        }
        let bypassUnkownMediaType = (disks === null);
        let promise;
        if (utils.isWin()) {
            if (disks) {
                for (let i = 0; i < disks.length; i++) {
                    disks[i] = disks[i].toUpperCase();
                    if (!disks[i].endsWith(':')) {
                        disks[i] += ':';
                    }
                }
            }
            promise = this.getWinDisksInfos(bypassUnkownMediaType);
        }
        else if (process.platform === 'linux') {
            promise = this.getLinuxDisksInfos();
        }
        else {
            return Promise.reject(new Error('Plateforme non reconnue: ' + process.platform));
        }
        return promise
            .then(disksInfos => {
            let disksHash = {};
            if (disks !== null) {
                for (let i = 0; i < disks.length; i++) {
                    if (typeof disksInfos[disks[i]] === 'undefined') {
                        disksHash[disks[i]] = {
                            name: disks[i],
                            free: null,
                            total: null,
                            used: null,
                            totalGO: null,
                            usedGO: null,
                            freeGO: null,
                            usedPercent: null,
                            isValid: false,
                            output: 'Le fs ' + disks[i] + " n'a pas été trouvé"
                        };
                    }
                    else {
                        disksHash[disks[i]] = disksInfos[disks[i]];
                    }
                }
            }
            else {
                Object.keys(disksInfos).forEach((fsName) => {
                    disksHash[fsName] = disksInfos[fsName];
                });
            }
            return disksHash;
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
        let seuilsInfos = '';
        seuilsInfos = 'seuil warning: ' + params.warn + '% , seuil critic: ' + params.critic + '%';
        let r = {
            output: '',
            currentState: null,
            perfdata: ''
        };
        let state = null;
        Object.keys(result).forEach((fsName) => {
            let diskInfo = result[fsName];
            if (diskInfo.isValid) {
                if (params.warn !== null) {
                    if (diskInfo.usedPercent >= params.warn) {
                        state = 'WARNING';
                        diskInfo.currentState = 1;
                        if (r.currentState !== 2) {
                            r.currentState = 1;
                        }
                    }
                }
                if (params.critic !== null) {
                    if (diskInfo.usedPercent >= params.critic) {
                        diskInfo.currentState = 2;
                        state = 'CRITIC';
                        r.currentState = 2;
                    }
                }
                diskInfo.output = state + ' - ' + diskInfo.name + ' utilisé à ' + diskInfo.usedPercent + '% (' + diskInfo.freeGO + 'GO libres/' + diskInfo.totalGO + 'Go)';
            }
            else {
                if (diskInfo.output) {
                    diskInfo.output = 'UNKNOWN - ' + diskInfo.name + ' ' + diskInfo.output;
                }
                else {
                    diskInfo.output = 'UNKNOWN - ' + diskInfo.name + ': aucune valeur renvoyée pour ce disque';
                }
            }
            r.output += diskInfo.output + '\n';
            if ((diskInfo.usedPercent !== null) && (diskInfo.used !== null)) {
                r.perfdata += "'" + diskInfo.name + " Space'=" + diskInfo.used + "B; '" + diskInfo.name + " Utilisation'=" + diskInfo.usedPercent + '%;' + params.warn + ';' + params.critic + '; ';
            }
        });
        r.output += seuilsInfos;
        r.output = r.output.trim();
        if (r.currentState === null) {
            r.currentState = 3;
        }
        let _r = r.currentState + '|' + r.output;
        if (r.perfdata !== '') {
            _r += '|' + r.perfdata;
        }
        return _r;
    }
    getWinDisksInfos(bypassUnkownMediaType = false) {
        return new Promise((resolve, reject) => {
            let cmd = 'WMIC LOGICALDISK GET Name,Size,FreeSpace,MediaType /format:csv';
            let child = child_process.exec(cmd);
            let stdout = '';
            let error = '';
            child.stdout.on('data', (data) => {
                stdout += data;
            });
            child.stderr.on('data', (data) => {
                error += data;
            });
            child.on('error', (err) => {
                error += err.message;
            });
            child.on('close', (code) => {
                try {
                    if (code !== 0) {
                        if (error !== '') {
                            reject('Echec appel ' + cmd + ' :' + error);
                        }
                        else {
                            reject('Echec appel ' + cmd + ' :' + stdout);
                        }
                    }
                    else if (error !== '') {
                        reject('Echec appel ' + cmd + ' :' + error);
                    }
                    else {
                        let r = {};
                        let lines = stdout.trim().split('\n');
                        for (let i = 1; i < lines.length; i++) {
                            let line = lines[i].trim();
                            let parts = line.split(',');
                            let diskInfos = {
                                name: parts[3],
                                free: null,
                                total: null,
                                used: null,
                                totalGO: null,
                                usedGO: null,
                                freeGO: null,
                                usedPercent: null,
                                isValid: false
                            };
                            let mediaType = parts[2];
                            if ((mediaType === '12') || (mediaType === '0')) {
                                diskInfos.free = parseInt(parts[1], 10);
                                diskInfos.total = parseInt(parts[4], 10);
                                if (isNaN(diskInfos.free) || isNaN(diskInfos.total)) {
                                    diskInfos.output = "La requête WMIC n'a renvoyé aucune valeur pour ce disque";
                                }
                                else {
                                    diskInfos.used = diskInfos.total - diskInfos.free;
                                    diskInfos.totalGO = this.convertBytesToGo(diskInfos.total);
                                    diskInfos.usedGO = this.convertBytesToGo(diskInfos.used);
                                    diskInfos.freeGO = this.convertBytesToGo(diskInfos.free);
                                    diskInfos.usedPercent = Math.round(100 * diskInfos.used / diskInfos.total);
                                    diskInfos.isValid = true;
                                }
                                r[diskInfos.name] = diskInfos;
                            }
                            else {
                                if (!bypassUnkownMediaType) {
                                    diskInfos.output = "Ce type de média (%MediaType%) n'est pas connu par ce plugin.";
                                    if (mediaType === '11') {
                                        diskInfos.output = diskInfos.output.replace('%MediaType%', 'Removable media other than floppy');
                                    }
                                    diskInfos.output += ` Types connus: 'Fixed hard disk media (12)', 'Format is unknown (0)'.
										Consultez la page <a target="_blank" href="https://msdn.microsoft.com/en-us/library/aa394173().aspx">https://msdn.microsoft.com/en-us/library/aa394173().aspx</a>`;
                                    r[diskInfos.name] = diskInfos;
                                }
                            }
                        }
                        resolve(r);
                    }
                }
                catch (err) {
                    reject(err);
                }
            });
        });
    }
    getLinuxDisksInfos() {
        return new Promise((resolve, reject) => {
            let cmd = 'df -P';
            let child = child_process.exec(cmd);
            let stdout = '';
            let error = '';
            child.stdout.on('data', (data) => {
                stdout += data;
            });
            child.stderr.on('data', (data) => {
                error += data;
            });
            child.on('error', (err) => {
                error += err.message;
            });
            child.on('close', (code) => {
                try {
                    if (code !== 0) {
                        if (error !== '') {
                            reject('Echec appel ' + cmd + ' :' + error);
                        }
                        else {
                            reject('Echec appel ' + cmd + ' :' + stdout);
                        }
                    }
                    else if (error !== '') {
                        reject('Echec appel ' + cmd + ' :' + error);
                    }
                    else {
                        let r = {};
                        let lines = stdout.split('\n');
                        for (let i = 1; i < lines.length; i++) {
                            lines[i] = lines[i].trim();
                            if (lines[i] !== '') {
                                let line = lines[i].trim().replace(/\s+/g, ' ');
                                let parts = line.split(' ');
                                let name = parts[5].trim();
                                let diskInfos = {
                                    name: name,
                                    free: null,
                                    total: null,
                                    used: null,
                                    totalGO: null,
                                    usedGO: null,
                                    freeGO: null,
                                    usedPercent: null,
                                    isValid: false
                                };
                                let used = parseInt(parts[2], 10) * 1024;
                                let free = parseInt(parts[3], 10) * 1024;
                                let usedPercent = parseInt(parts[4].replace('%', ''), 10);
                                if (isNaN(used) || isNaN(free) || isNaN(usedPercent)) {
                                    diskInfos.output = 'Impossible de récupérer les données du fs ' + name;
                                }
                                else {
                                    diskInfos.isValid = true;
                                    diskInfos.used = used;
                                    diskInfos.free = free;
                                    diskInfos.total = used + free;
                                    diskInfos.usedGO = this.convertBytesToGo(used);
                                    diskInfos.freeGO = this.convertBytesToGo(free);
                                    diskInfos.totalGO = this.convertBytesToGo(diskInfos.total);
                                    diskInfos.usedPercent = usedPercent;
                                }
                                r[name] = diskInfos;
                            }
                        }
                        resolve(r);
                    }
                }
                catch (err) {
                    reject(err);
                }
            });
        });
    }
}
exports.Tmetric = Tmetric;
//# sourceMappingURL=Tmetric.js.map