"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Promise = require("bluebird");
const child_process = require("child_process");
require("./StringTools");
class ChildProcess {
    static spawnCmd(cmd, args) {
        return new Promise((resolve, reject) => {
            let argsArray = ['/C', cmd].concat(args);
            let stdout = '';
            let stderr = '';
            let child = child_process.spawn('cmd', argsArray, {});
            child.on('close', (code) => {
                let r = {
                    exitCode: code,
                    stdout: stdout.replace(/\u0000/g, ''),
                    stderr: stderr.replace(/\u0000/g, '')
                };
                resolve(r);
            });
            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            child.on('error', (error) => {
                reject(error);
            });
        });
    }
    static execCmd(cmd, args) {
        return new Promise((resolve, reject) => {
            let argsStr = '';
            if (args.length > 0) {
                argsStr = '"' + args.join('" "') + '"';
            }
            child_process.exec('"' + cmd + '"' + ' ' + argsStr, (error, stdout, stderr) => {
                let exitCode = 0;
                if (error) {
                    exitCode = error.code;
                }
                let r = {
                    exitCode: exitCode,
                    stdout: stdout.replace(/\u0000/g, ''),
                    stderr: stderr.replace(/\u0000/g, '')
                };
                resolve(r);
            });
        });
    }
}
exports.ChildProcess = ChildProcess;
//# sourceMappingURL=ChildProcess.js.map