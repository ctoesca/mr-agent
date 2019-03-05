"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const mime = require("mime");
const utils = require("../utils");
const Promise = require("bluebird");
require("./StringTools");
class Files {
    static isDir(path) {
        return new Promise((resolve, reject) => {
            fs.stat(path, (err, stats) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(stats.isDirectory());
                }
            });
        });
    }
    static getFileName(path) {
        return require('path').basename(path);
    }
    static getFileSize(path) {
        let stats = fs.statSync(path);
        return stats.size;
    }
    static getFileStat(path, includeMime = false) {
        let fileStat = fs.lstatSync(path);
        let name = Files.getFileName(path);
        let r = {
            name: name,
            path: path,
            date: utils.getDateFromTimestamp(fileStat.mtime),
            size: fileStat.size,
            isFile: (fileStat.isFile()),
            isDir: (fileStat.isDirectory()),
            isLink: (fileStat.isSymbolicLink())
        };
        if (includeMime && !r.isDir && !r.isLink) {
            r.contentType = mime.getType(path);
            if (r.contentType) {
                r.contentSubType = r.contentType.leftOf('/');
            }
        }
        return r;
    }
}
exports.Files = Files;
//# sourceMappingURL=Files.js.map