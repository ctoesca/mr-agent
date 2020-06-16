"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Files = void 0;
const fs = require("fs-extra");
const mime = require("mime");
const utils = require("../utils");
const Promise = require("bluebird");
require("./StringTools");
class Files {
    static getFilePart(path, blocNum, blocksize = 1024 * 1024 * 1024) {
        try {
            let opt = {
                start: blocNum * blocksize,
                end: blocNum * blocksize + blocksize - 1
            };
            let size = fs.statSync(path).size;
            if (opt.start >= size) {
                throw "start (" + opt.start + ") >= filesize (" + size + ')';
            }
            if (opt.end > size) {
                opt.end = size;
            }
            if (opt.start >= opt.end) {
                throw "start (" + opt.start + ") >= end (" + size + ')';
            }
            let readStream = fs.createReadStream(path, opt);
            return Promise.resolve({
                stream: readStream,
                start: opt.start,
                end: opt.end,
                totalSize: size
            });
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    static mergeFiles(files, destPath, deletePartsOnSuccess = true) {
        return new Promise((resolve, reject) => {
            try {
                let writeStream = fs.createWriteStream(destPath);
                console.log("Creation stream " + destPath);
                return Promise.each(files, (file) => {
                    return this.appendFileToStream(file, writeStream);
                })
                    .then((results) => {
                    for (let file of files)
                        fs.unlinkSync(file);
                    resolve({
                        files: files,
                        destPath: destPath
                    });
                })
                    .finally(() => {
                    writeStream.close();
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }
    static appendFileToStream(path, stream) {
        return new Promise((resolve, reject) => {
            fs.createReadStream(path)
                .on('error', function (err) {
                reject(err);
            })
                .on('end', function () {
            })
                .on('close', function () {
                console.log("appendFileToStream success " + path);
                resolve();
            })
                .on('data', function (chunk) {
                stream.write(chunk);
            });
        });
    }
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