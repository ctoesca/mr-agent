"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Application_1 = require("../../Application");
const fs = require("fs-extra");
const child_process = require("child_process");
const klaw = require("klaw");
const minimatch = require("minimatch");
const Files_1 = require("../../utils/Files");
const utils = require("../../utils");
class Tools {
    constructor(opt) {
        this.tmpDir = null;
        this.logger = null;
        this.tmpDir = opt.tmpDir;
        this.logger = Application_1.Application.getLogger(this.constructor.name);
    }
    listFiles(dir) {
        return fs.readdir(dir)
            .then((files) => {
            let r = {
                files: [],
                total: 0
            };
            for (let path of files) {
                path = dir + '/' + path;
                try {
                    r.files.push(Files_1.Files.getFileStat(path, true));
                }
                catch (err) {
                    this.logger.warn('getFileStat(' + path + '): ' + err.toString());
                }
                r.total++;
            }
            return r;
        });
    }
    findFiles(dir, filter, recursive, maxResults) {
        return fs.pathExists(dir)
            .then(exists => {
            if (!exists) {
                throw new Error(dir + ' does not exist');
            }
            if (!recursive) {
                return this.listFiles(dir)
                    .then((results) => {
                    if (filter !== '*') {
                        let filteredResults = [];
                        for (let file of results.files) {
                            if (minimatch(file.name, filter, { matchBase: true }))
                                filteredResults.push(file);
                        }
                        return filteredResults;
                    }
                    else {
                        return results;
                    }
                });
            }
            else {
                return new Promise((resolve, reject) => {
                    let items = [];
                    let opt = {
                        preserveSymlinks: true
                    };
                    klaw(dir, opt)
                        .on('data', (item) => {
                        if (item.path !== dir) {
                            items.push(item.path);
                        }
                    })
                        .on('error', (err) => {
                        reject(err);
                    })
                        .on('end', () => {
                        try {
                            let r = this.processKlawResults(items, filter, maxResults);
                            resolve(r);
                        }
                        catch (err) {
                            reject(err);
                        }
                    });
                });
            }
        });
    }
    execScript(script, args = []) {
        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            let isWin = utils.isWin();
            let outFile = this.tmpDir + '\\' + Math.random() + '.bat';
            fs.writeFileSync(outFile, script, 'utf8');
            let child;
            let cmd = '"' + outFile + '"';
            if (args.length > 0) {
                for (let i = 0; i < args.length; i++) {
                    cmd += ' "' + args[i] + '"';
                }
            }
            if (isWin) {
                cmd = 'chcp 65001 | ' + cmd;
            }
            child = child_process.exec(cmd, {
                maxBuffer: 1024 * 1024 * 2
            });
            child.stdout.on('data', (data) => {
                stdout += data;
            });
            child.stderr.on('data', (data) => {
                stderr += data;
            });
            child.on('error', (error) => {
                this.logger.error(error);
                stderr += error.message;
                reject(error);
            });
            child.on('exit', (code) => {
                this.logger.debug('EXIT ' + code);
            });
            child.on('close', (code) => {
                fs.unlinkSync(outFile);
                if (code === null) {
                    code = 0;
                }
                resolve({ exitCode: code, stdout: stdout, stderr: stderr });
            });
        });
    }
    processKlawResults(items, filter, maxResults) {
        let r = {
            files: [],
            total: 0
        };
        if (filter !== '*') {
            items = items.filter(minimatch.filter(filter, { matchBase: true }));
        }
        r.total = items.length;
        if (items.length > maxResults) {
            items.splice(maxResults, items.length);
        }
        for (let i = 0; i < items.length; i++) {
            let filePath = items[i];
            let fileinfo = null;
            try {
                fileinfo = Files_1.Files.getFileStat(filePath, true);
            }
            catch (err) {
                let msg = 'getFileStat(' + filePath + ') : ' + err.toString();
                this.logger.error(msg);
                throw new Error(msg);
            }
            r.files.push(fileinfo);
        }
        return r;
    }
}
exports.Tools = Tools;
//# sourceMappingURL=Tools.js.map