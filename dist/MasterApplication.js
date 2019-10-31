"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cluster = require("cluster");
const os = require("os");
const fs = require("fs-extra");
const Timer_1 = require("./utils/Timer");
const Application_1 = require("./Application");
const child_process = require("child_process");
const klaw = require("klaw");
const p = require("path");
class MasterApplication extends Application_1.Application {
    constructor(configPath, opt = {}) {
        super(configPath, opt);
        this.workersStats = {};
        this.workers = new Map();
        this.workersArray = [];
        this.lastStat = null;
        this.numProcesses = os.cpus().length;
        this.tmpFilesRetention = 12;
        this.tmpPurgeInterval = 900 * 1000;
        if (typeof this.config.numProcesses !== 'undefined') {
            if (this.config.numProcesses === 'auto') {
                this.numProcesses = os.cpus().length;
            }
            else {
                this.numProcesses = this.config.numProcesses;
            }
        }
        if (typeof this.config.startScript !== 'undefined') {
            this.execScript(this.config.startScript);
        }
        for (let i = 0; i < this.numProcesses; i++) {
            cluster.fork();
        }
        cluster.on('exit', (worker, code, signal) => {
            this.onExitWorker(worker, code, signal);
        });
        cluster.on('fork', (worker) => {
            this.onForkWorker(worker);
        });
        this.statTimer = new Timer_1.default({ delay: 20000 });
        this.statTimer.on(Timer_1.default.ON_TIMER, this.onStatTimer.bind(this));
        this.statTimer.start();
        this.logger.info("Durée de rétention des fichiers temporaires: " + this.tmpFilesRetention + "H");
        this.purgeTimer = new Timer_1.default({ delay: this.tmpPurgeInterval });
        this.purgeTimer.on(Timer_1.default.ON_TIMER, this.onPurgeTimer.bind(this));
        this.purgeTimer.start();
    }
    execScript(script) {
        return new Promise((resolve, reject) => {
            this.logger.info('**************  EXCUTION SCRIPT *************');
            this.logger.info(script);
            try {
                let scriptPath = this.config.tmpDir + '/startScript.bat';
                fs.writeFileSync(scriptPath, script);
                let child = child_process.spawn(scriptPath);
                let stdout = '';
                let stderr = '';
                child.stdout.on('data', (data) => {
                    stdout += data;
                });
                child.stderr.on('data', (data) => {
                    stderr += data;
                });
                child.on('error', (err) => {
                    reject(err);
                });
                child.on('close', (code) => {
                    this.logger.info('stdout=' + stdout);
                    if (stderr) {
                        this.logger.error('stderr=' + stderr);
                    }
                    this.logger.info('*********************************************');
                    resolve({
                        exitCode: code,
                        stdout: stdout,
                        stderr: stderr
                    });
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }
    onPurgeTimer() {
        this.logger.info("Purge des fichiers temporaires en cours...");
        let now = new Date().getTime();
        klaw(this.config.tmpDir)
            .on('data', (item) => {
            if (item.stats.isFile()) {
                let filename = p.basename(item.path);
                if (filename != 'PID.txt') {
                    let diffH = Math.round(10 * (now - item.stats.mtimeMs) / (1000 * 60 * 60)) / 10;
                    if (diffH > this.tmpFilesRetention) {
                        fs.remove(item.path)
                            .then(() => {
                            this.logger.info("Fichier temporaire supprimé: " + item.path);
                        })
                            .catch(err => {
                            this.logger.error("Purge : " + err.toString());
                        });
                    }
                }
            }
        })
            .on('end', () => {
            this.logger.info("Purge des fichiers temporaires terminée.");
        })
            .on('error', (err, item) => {
            this.logger.error("Purge fichiers temporaires: ", err.message);
            this.logger.error("Purge fichiers temporaires: path=" + item.path);
        });
    }
    onStatTimer() {
        if (this.workersStats.logIngest) {
            if (this.lastStat) {
                let now = new Date();
                let diff = now.getTime() - this.lastStat.getTime();
                let createRate = Math.round((this.workersStats.logIngest.totalCreated / (diff / 1000)) * 10) / 10;
                let tauxRejet = Math.round((100 * (this.workersStats.logIngest.totalInput - this.workersStats.logIngest.totalCreated) / this.workersStats.logIngest.totalInput) * 10) / 10;
                if (createRate > 0) {
                    this.logger.info('INGEST RATE=' + createRate + '/sec, REJETS=' + tauxRejet + '%, created=' + this.workersStats.logIngest.totalCreated + '/' + this.workersStats.logIngest.totalInput);
                }
                this.lastStat = new Date();
                this.workersStats = {};
            }
            else {
                this.lastStat = new Date();
            }
        }
    }
    onExitWorker(worker, code, signal) {
        this.logger.warn(`worker ${worker.process.pid} died code=` + code);
        this.workers.delete(worker.process.pid);
        for (let i = 0; i < this.workersArray.length; i++) {
            if (this.workersArray[i].process.pid === worker.process.pid) {
                this.workersArray.splice(i, 1);
                break;
            }
        }
        if ((code !== 99) && (code !== 98)) {
            this.logger.warn(`worker ${worker.id} disconnected`);
            if (this.config.forkOnWorkerExit !== false) {
                cluster.fork();
            }
        }
        else if (code === 98) {
            this.workers.forEach((w, pid) => {
                this.logger.info('KILL worker ' + pid);
                process.kill(pid);
            });
            process.exit();
        }
        else if (code === 99) {
            let supervisorPID = fs.readFileSync(this.config.tmpDir + '/PID.txt');
            process.kill(parseInt(supervisorPID.toString(), 10));
            this.workers.forEach((w, pid) => {
                this.logger.info('KILL worker ' + pid);
                process.kill(pid);
            });
            process.exit();
        }
        this.emit('worker-exit', worker, code, signal);
    }
    onWorkerMessage(msg) {
        if (msg.logIngestStats) {
            if (!this.workersStats.logIngest) {
                this.workersStats.logIngest = msg.logIngestStats;
            }
            else {
                Object.keys(msg.logIngestStats).forEach((k) => {
                    this.workersStats.logIngest[k] += msg.logIngestStats[k];
                });
            }
        }
    }
    onForkWorker(worker) {
        this.workers[worker.process.pid] = worker;
        this.workersArray.push(worker);
        worker.on('message', (msg) => {
            this.onWorkerMessage(msg);
        });
        this.logger.info('************ FORK WORKER **************');
    }
}
exports.MasterApplication = MasterApplication;
//# sourceMappingURL=MasterApplication.js.map