"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwinTools = void 0;
const Tools_1 = require("./Tools");
const child_process = require("child_process");
const fs = require("fs-extra");
class TwinTools extends Tools_1.Tools {
    constructor(opt) {
        super(opt);
    }
    execPowershell(script, args = []) {
        let outFile = this.tmpDir + '\\' + Math.random() + '.ps1';
        return fs.writeFile(outFile, script, 'utf8')
            .then(() => {
            return new Promise((resolve, reject) => {
                try {
                    let stdout = '';
                    let stderr = '';
                    let child;
                    let commandArgs = '';
                    if (args.length > 0) {
                        for (let i = 0; i < args.length; i++) {
                            commandArgs += args[i] + ' ';
                        }
                    }
                    let cmd = 'powershell -NoLogo -NonInteractive -File "' + outFile + '" ' + commandArgs;
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
                        if (code === null) {
                            code = 0;
                        }
                        resolve({ exitCode: code, stdout: stdout, stderr: stderr });
                    });
                }
                catch (err) {
                    reject(err);
                }
            })
                .finally(() => {
                fs.unlink(outFile)
                    .catch((err) => {
                    this.logger.error("Echec suppression outFile", err);
                });
            });
        });
    }
}
exports.TwinTools = TwinTools;
//# sourceMappingURL=TwinTools.js.map