"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpTools = void 0;
const fs = require("fs-extra");
const p = require("path");
const Files_1 = require("./Files");
const Promise = require("bluebird");
const Application_1 = require("../Application");
const utils = require(".");
const urlParser = require("url");
const Errors = require("../Errors");
const Busboy = require("busboy");
const Archiver = require('archiver');
const HttpsProxyAgent = require('https-proxy-agent');
const https = require('https');
class HttpTools {
    static getApplication() {
        return Application_1.Application.getInstance();
    }
    static getLogger() {
        return this.getApplication().getLogger('HttpTools');
    }
    static getSslCertificate(opt) {
        try {
            let params = utils.parseParams(opt, {
                hostname: {
                    type: 'string'
                },
                port: {
                    type: 'integer',
                    default: 443
                },
                method: {
                    default: 'GET',
                    type: 'string'
                },
                protocol: {
                    default: "https:",
                    type: 'string'
                },
                timeout: {
                    default: 5000,
                    type: 'integer'
                }
            });
            if (typeof opt.proxy !== 'undefined')
                params.proxy = opt.proxy;
            let options = {
                hostname: params.hostname,
                agent: false,
                rejectUnauthorized: false,
                ciphers: 'ALL',
                port: params.port,
                protocol: params.protocol
            };
            if (params.timeout)
                options.timeout = params.timeout;
            if (params.proxy) {
                options.agent = new HttpsProxyAgent(params.proxy);
            }
            var promiseIsResolved = false;
            this.getLogger().info("getSslCertificate sur " + params.hostname + ':' + params.port + '...');
            return new Promise((resolve, reject) => {
                var timeout;
                var req = https.get(options, (res) => {
                    try {
                        if (timeout)
                            clearTimeout(timeout);
                        this.getLogger().info("getSslCertificate response sur " + params.hostname + ':' + params.port);
                        var certificate = res.socket.getPeerCertificate();
                        if (utils.isEmpty(certificate) || certificate === null) {
                            if (!promiseIsResolved) {
                                reject(new Error('The website did not provide a certificate'));
                                promiseIsResolved = true;
                            }
                        }
                        else {
                            if (certificate.raw) {
                                certificate.pemEncoded = this.pemEncode(certificate.raw.toString('base64'), 64);
                            }
                            if (!promiseIsResolved) {
                                resolve(certificate);
                                promiseIsResolved = true;
                            }
                        }
                    }
                    catch (err) {
                        this.getLogger().error("getSslCertificate response exception sur " + params.hostname + ':' + params.port);
                        if (!promiseIsResolved) {
                            reject(err);
                            promiseIsResolved = true;
                        }
                    }
                });
                req.on('timeout', (err) => {
                    this.getLogger().info("getSslCertificate timeout1 sur " + params.hostname + ':' + params.port);
                    req.destroy('Request timed out');
                });
                req.on('error', (err) => {
                    this.getLogger().info("getSslCertificate error sur " + params.hostname + ':' + params.port, err);
                    if (timeout)
                        clearTimeout(timeout);
                    if (!promiseIsResolved) {
                        reject(err);
                        promiseIsResolved = true;
                    }
                });
                req.end();
            });
        }
        catch (err) {
            this.getLogger().error("getSslCertificate exception ", err);
            return Promise.reject(err);
        }
    }
    static pemEncode(str, n) {
        var ret = [];
        for (var i = 1; i <= str.length; i++) {
            ret.push(str[i - 1]);
            var mod = i % n;
            if (mod === 0) {
                ret.push('\n');
            }
        }
        var returnString = `-----BEGIN CERTIFICATE-----\n${ret.join('')}\n-----END CERTIFICATE-----`;
        return returnString;
    }
    static saveUploadedFile(req, res, next, opt = {}) {
        opt = utils.parseParams(opt, {
            path: {
                default: null,
                type: 'string'
            },
            createDir: {
                default: true,
                type: 'boolean'
            },
            overwrite: {
                default: true,
                type: 'boolean'
            },
            onBeforeSaveFile: {
                default: null,
                type: 'function'
            },
            maxUploadSize: {
                default: null,
                type: 'integer'
            },
            start: {
                default: null,
                type: 'number'
            }
        });
        return new Promise((resolve, reject) => {
            let result = {
                files: [],
                fields: []
            };
            let promiseResolved = false;
            let hasFile = false;
            try {
                let busboy = new Busboy({ headers: req.headers });
                busboy.on('field', (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) => {
                    this.getLogger().debug("upload field: " + fieldname + '=' + val);
                    result.fields[fieldname] = {
                        val: val,
                        fieldnameTruncated: fieldnameTruncated,
                        valTruncated: valTruncated,
                        encoding: encoding,
                        mimetype: mimetype
                    };
                });
                busboy.on('finish', () => {
                    if (!hasFile && !promiseResolved) {
                        reject(new Errors.HttpError('No file uploaded', 400));
                    }
                });
                busboy.on('file', (fieldName, file, filename, encoding, mimetype) => {
                    if (hasFile) {
                        if (!promiseResolved) {
                            promiseResolved = true;
                            reject(new Errors.BadRequest("Only one file can be uploaded"));
                        }
                        file.resume();
                        return;
                    }
                    hasFile = true;
                    let checkPromise;
                    if (opt.onBeforeSaveFile) {
                        checkPromise = opt.onBeforeSaveFile(result.fields, opt, filename, encoding, mimetype, file);
                    }
                    else {
                        checkPromise = Promise.resolve(opt);
                    }
                    checkPromise.then((r) => {
                        if (r)
                            opt = r;
                        let pathIsTmp = false;
                        if (opt.path === null) {
                            pathIsTmp = true;
                            opt.path = p.normalize(Application_1.Application.getInstance().getTmpDir() + '/uploads/' + Math.round(Math.random() * 100000000000)) + '.' + filename;
                        }
                        let uploadDir = p.normalize(p.dirname(opt.path));
                        if (!fs.pathExistsSync(uploadDir)) {
                            if (pathIsTmp || opt.createDir) {
                                fs.ensureDirSync(uploadDir);
                            }
                            else {
                                throw new Errors.BadRequest('Upload directory does not exist: ' + uploadDir);
                            }
                        }
                        if (fs.pathExistsSync(opt.path)) {
                            if (Files_1.Files.getFileStat(opt.path).isDir) {
                                throw new Errors.BadRequest('Upload destination is a directory: ' + opt.path);
                            }
                            if (!opt.overwrite && !opt.start)
                                throw new Errors.BadRequest('File already exists: ' + opt.path);
                        }
                        return this.checkUploadSize(opt.path, req, opt.maxUploadSize);
                    })
                        .then(() => {
                        if (!promiseResolved) {
                            let f = {
                                name: filename,
                                fieldName: fieldName,
                                encoding: encoding,
                                mimeType: mimetype,
                                path: opt.path
                            };
                            result.files.push(f);
                            let createStreamOpt = {};
                            if (opt.start !== null) {
                                createStreamOpt = {
                                    flags: 'r+',
                                    mode: 777,
                                    start: opt.start
                                };
                            }
                            let fstream = fs.createWriteStream(opt.path, createStreamOpt);
                            file.pipe(fstream);
                            fstream.on('error', (err) => {
                                promiseResolved = true;
                                reject(err);
                            });
                            fstream.on('finish', () => {
                                if (!promiseResolved) {
                                    promiseResolved = true;
                                    resolve(result);
                                }
                            });
                        }
                        else {
                            file.resume();
                        }
                    })
                        .catch(err => {
                        file.resume();
                        if (!promiseResolved) {
                            promiseResolved = true;
                            reject(err);
                        }
                    });
                });
                req.pipe(busboy);
            }
            catch (err) {
                if (!promiseResolved) {
                    promiseResolved = true;
                    reject(err);
                }
            }
        });
    }
    static checkUploadSize(destFilePath, req, max = null) {
        let app = this.getApplication();
        if (utils.isWin() && req.headers['content-length']) {
            let contentLength = parseInt(req.headers['content-length'], 10);
            if ((max !== null) && (contentLength >= max))
                return Promise.reject(new Errors.BadRequest('Taille max upload: ' + max / 1024 / 1024 + ' Mo'));
            if (contentLength > 1024 * 1024 * 20) {
                let metrics = app.getPluginInstance('metrics');
                if (metrics) {
                    return metrics.getMetric('disks')
                        .get()
                        .then((result) => {
                        let diskName = destFilePath.leftOf(':').toUpperCase();
                        if (typeof result[diskName + ':'] !== 'undefined') {
                            let diskInfos = result[diskName + ':'];
                            let maxFileSize = (diskInfos.free - (5 * diskInfos.total / 100));
                            if (contentLength >= maxFileSize) {
                                throw new Errors.BadRequest('Espace insuffisant sur le disque ' + diskName);
                            }
                        }
                        return true;
                    });
                }
                else {
                    this.getLogger().error("Aucune instance de 'checker' n'est instanciée");
                    return Promise.resolve();
                }
            }
            else {
                return Promise.resolve();
            }
        }
        else {
            return Promise.resolve();
        }
    }
    static sendZipFile(res, next, path, zipFileName) {
        let opt = utils.parseParams({
            path: path,
            zipFileName: zipFileName
        }, {
            path: {
                type: 'string'
            },
            zipFileName: {
                type: 'string'
            }
        });
        return Files_1.Files.isDir(opt.path)
            .then((isDir) => {
            return new Promise((resolve, reject) => {
                try {
                    let zip = Archiver('zip');
                    zip.on('end', () => {
                        if (!res.headersSent) {
                            res.set('Content-Type', 'application/zip');
                            res.status(200);
                            res.send('OK').end();
                        }
                        resolve({ message: 'Envoi zip ok' });
                    });
                    zip.on('error', (err) => {
                        reject(err);
                    });
                    zip.on('finish', function () {
                        resolve({ message: 'Envoi zip ok' });
                    });
                    zip.pipe(res);
                    if (isDir) {
                        zip.directory(opt.path, '', (data) => {
                            return data;
                        });
                    }
                    else {
                        let files = [opt.path];
                        for (let f of files) {
                            zip.append(fs.createReadStream(f), { name: p.basename(f) });
                        }
                    }
                    res.attachment(opt.zipFileName);
                    zip.finalize();
                }
                catch (err) {
                    reject(err);
                }
            });
        });
    }
    static getBodyParams(req, fields) {
        if (typeof req.body === 'undefined') {
            throw new Errors.BadRequest('body undefined');
        }
        let params = req.body;
        return utils.parseParams(params, fields, true);
    }
    static getQueryParams(req, fields) {
        let u = urlParser.parse(req.url, true);
        let params = u.query;
        return utils.parseParams(params, fields, false);
    }
}
exports.HttpTools = HttpTools;
//# sourceMappingURL=HttpTools.js.map