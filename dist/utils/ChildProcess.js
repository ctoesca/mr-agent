"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Promise = require("bluebird");
const child_process = require("child_process");
require("./StringTools");
class ChildProcess {
    static spawn(path, args = [], opt = {}) {
        return new Promise((resolve, reject) => {
            try {
                let stderr = '';
                let stdout = '';
                let error = null;
                let child = child_process.spawn(path, args);
                child.stdout.on('data', (data) => {
                    stdout += data;
                    if (opt.logger) {
                        opt.logger.info(data.toString());
                    }
                });
                child.stderr.on('data', (data) => {
                    if (opt.logger) {
                        opt.logger.error(data.toString());
                    }
                    stderr += data;
                });
                child.on('error', (err) => {
                    if (opt.logger) {
                        opt.logger.error(err.toString());
                    }
                    error = err;
                });
                child.on('close', (code) => {
                    if (code === null) {
                        code = 0;
                    }
                    if (!error) {
                        resolve({
                            stdout: stdout,
                            stderr: stderr,
                            exitCode: code
                        });
                    }
                    else {
                        reject(error);
                    }
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }
}
exports.ChildProcess = ChildProcess;
//# sourceMappingURL=ChildProcess.js.map