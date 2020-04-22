"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ThttpPlugin_1 = require("../ThttpPlugin");
const Files_1 = require("../../utils/Files");
const HttpTools_1 = require("../../utils/HttpTools");
const TwinTools_1 = require("./TwinTools");
const TlinuxTools_1 = require("./TlinuxTools");
const fs = require("fs-extra");
const p = require("path");
const vm = require("vm");
const utils = require("../../utils");
require("../../utils/StringTools");
const Errors = require("../../Errors");
const Promise = require("bluebird");
const bodyParser = require("body-parser");
const rimraf = require("rimraf");
const streamZip = require('node-stream-zip');
class Tplugin extends ThttpPlugin_1.ThttpPlugin {
    constructor(application, config) {
        super(application, config);
        this.tools = null;
        if (utils.isWin()) {
            this.tools = new TwinTools_1.TwinTools({ tmpDir: this.tmpDir, module: this });
        }
        else {
            this.tools = new TlinuxTools_1.TlinuxTools({ tmpDir: this.tmpDir, module: this });
        }
        if (!this.config.maxUploadSize) {
            this.config.maxUploadSize = 500 * 1024 * 1024;
        }
    }
    install() {
        super.install();
        this.app.use(bodyParser.json({
            limit: '500mb'
        }));
        this.app.get('/list', this.list.bind(this));
        this.app.get('/fileinfo', this.fileinfo.bind(this));
        this.app.get('/download', this.download.bind(this));
        this.app.post('/upload', this.upload.bind(this));
        this.app.post('/execScript', this.execScript.bind(this));
        this.app.post('/writeTextFile', this.writeTextFile.bind(this));
        this.app.post('/deleteFiles', this.deleteFiles.bind(this));
        this.app.post('/moveFile', this.moveFile.bind(this));
        this.app.get('/fileExists', this.fileExists.bind(this));
        this.app.post('/copyFile', this.copyFile.bind(this));
        this.app.post('/uncompressFile', this.uncompressFile.bind(this));
        this.app.post('/createDir', this.createDir.bind(this));
    }
    writeTextFile(req, res, next) {
        let params = HttpTools_1.HttpTools.getBodyParams(req, {
            content: {
                type: 'string'
            },
            path: {
                type: 'string'
            }
        });
        fs.writeFile(params.path, params.content)
            .then(() => {
            let r = {
                path: params.path,
                fileinfo: null
            };
            r.fileinfo = Files_1.Files.getFileStat(params.path, true);
            res.status(200).json(r);
        })
            .catch(err => {
            this.logger.error('ERROR writeTextFile path=' + params.path + '" : ' + err.toString());
            next(err);
        });
    }
    execScript(req, res, next) {
        let params = HttpTools_1.HttpTools.getBodyParams(req, {
            script: {
                type: 'string'
            },
            type: {
                default: 'shell',
                type: 'string'
            },
            args: {
                default: [],
                type: 'array'
            }
        });
        this.logger.info('filesystem/execScript type=' + params.type);
        if (params.type === 'shell') {
            this.tools.execScript(params.script, params.args).then(function (result) {
                res.status(200).json(result);
            }, function (error) {
                res.status(500).json(error);
            });
        }
        else if (params.type === 'javascript') {
            const sandbox = {
                fs: require('fs'),
                $this: this,
                result: null,
                exitCode: 0
            };
            vm.runInNewContext(params.script, sandbox);
            res.status(200).json({ exitCode: sandbox.exitCode, stdout: sandbox.result, stderr: '' });
        }
        else {
            throw new Errors.HttpError("Valeur incorrect pour la propriété 'type'. Valeurs possible: 'shell'|'javascript'", 412);
        }
    }
    checkUploadSize(destFilePath, req) {
        if (utils.isWin() && req.headers['content-length']) {
            let fileSize = parseInt(req.headers['content-length'], 10);
            let metrics = this.application.getPluginInstance('metrics');
            if (metrics) {
                return metrics.getMetric('disks')
                    .get()
                    .then((result) => {
                    let diskName = destFilePath.leftOf(':').toUpperCase();
                    if (typeof result[diskName + ':'] !== 'undefined') {
                        let diskInfos = result[diskName + ':'];
                        let maxFileSize = (diskInfos.free - (5 * diskInfos.total / 100));
                        if (fileSize >= this.config.maxUploadSize) {
                            throw new Error('Taille max upload: ' + this.config.maxUploadSize / 1024 / 1024 + ' Mo');
                        }
                        else if (fileSize >= maxFileSize) {
                            throw new Error('Espace insuffisant');
                        }
                    }
                    return true;
                });
            }
            else {
                this.logger.error("Aucune instance de 'checker' n'est instanciée");
                return Promise.resolve();
            }
        }
        else {
            return Promise.resolve();
        }
    }
    upload(req, res, next) {
        let params = HttpTools_1.HttpTools.getQueryParams(req, {
            path: {
                type: 'string'
            },
            overwrite: {
                default: true,
                type: 'boolean'
            }
        });
        this.logger.info('Upload ' + params.path + ', overwrite = ' + params.overwrite);
        let uploadDir = p.normalize(p.dirname(params.path));
        if (!fs.pathExistsSync(uploadDir)) {
            throw new Errors.HttpError(uploadDir + ' directory does not exist', 400);
        }
        if (fs.pathExistsSync(params.path)) {
            if (!Files_1.Files.getFileStat(params.path).isFile) {
                throw new Errors.HttpError('Upload destination is directory: ' + params.path, 400);
            }
            if (!params.overwrite) {
                throw new Errors.HttpError('File already exist: ' + params.path + ' (use overwrite option)', 400);
            }
        }
        this.checkUploadSize(params.path, req)
            .then(() => {
            return HttpTools_1.HttpTools.saveUploadedFile(req, res, next);
        })
            .then((result) => {
            if (result.files.length === 0) {
                throw new Errors.HttpError('No file uploaded', 400);
            }
            else {
                return fs.move(result.files[0].path, params.path, { overwrite: params.overwrite });
            }
        })
            .then(result => {
            this.logger.info('Succes upload ' + params.path + ', overwrite = ' + params.overwrite);
            let r = {
                path: params.path,
                file: Files_1.Files.getFileStat(params.path, true)
            };
            res.status(200).json(r);
        })
            .catch((err) => {
            this.logger.error(err.toString());
            next(err);
        });
    }
    download(req, res, next) {
        let params = HttpTools_1.HttpTools.getQueryParams(req, {
            path: {
                type: 'string'
            },
            compress: {
                default: false,
                type: 'boolean'
            }
        });
        if (utils.isWin()) {
            params.path = params.path.replace(/\//g, '\\');
        }
        if (!fs.existsSync(params.path)) {
            this.logger.warn('download path=' + params.path + ': fichier inexistant');
            throw new Errors.NotFound('Le fichier ' + params.path + ' n\'existe pas');
        }
        else {
            let stat = Files_1.Files.getFileStat(params.path, false);
            if (stat.isDir) {
                params.compress = true;
            }
        }
        this.logger.info('download path=' + params.path + ',compress=' + params.compress);
        if (params.compress) {
            let zipFileName = Files_1.Files.getFileName(params.path) + '.zip';
            HttpTools_1.HttpTools.sendZipFile(res, next, params.path, zipFileName)
                .catch((err) => {
                next(err);
            });
        }
        else {
            res.download(params.path);
        }
    }
    deleteFiles(req, res, next) {
        let params = HttpTools_1.HttpTools.getBodyParams(req, {
            path: {
                type: 'string'
            }
        });
        this.logger.info('deleteFiles path=' + params.path);
        let filename = require('path').basename(params.path);
        if (!fs.existsSync(params.path)) {
            this.logger.warn('path=' + params.path + ' => fichier inexistant');
            throw new Errors.NotFound("'" + params.path + '- does not exist');
        }
        else {
            let stat = Files_1.Files.getFileStat(params.path, true);
            if (stat.isDir) {
                rimraf(params.path, (err) => {
                    if (err)
                        next(err);
                    else
                        res.status(200).json({ filename: filename, path: params.path });
                });
            }
            else {
                fs.unlink(params.path).then(() => {
                    res.status(200).json({ filename: filename, path: params.path });
                })
                    .catch((err) => {
                    next(err);
                });
            }
        }
    }
    createDir(req, res, next) {
        let params = HttpTools_1.HttpTools.getBodyParams(req, {
            parentDir: {
                type: 'string'
            },
            name: {
                type: 'string',
                default: null
            }
        });
        this.logger.info('createDir parentDir=' + params.parentDir);
        let fullPath;
        if (!params.name) {
            params.name = "nouveau_dossier";
            let index = 0;
            while (fs.existsSync(params.parentDir + "/" + params.name)) {
                index++;
                params.name = "nouveau_dossier_" + index;
            }
        }
        fullPath = p.normalize(params.parentDir + "/" + params.name);
        fs.pathExists(fullPath)
            .then(pathExits => {
            if (pathExits) {
                throw new Errors.HttpError(fullPath + ' already exists', 400);
            }
            return fs.ensureDir(fullPath);
        })
            .then(() => {
            let r = {
                path: fullPath,
                name: params.name
            };
            r.fileinfo = Files_1.Files.getFileStat(fullPath, true);
            res.status(200).json(r);
        })
            .catch(err => {
            next(err);
        });
    }
    moveFile(req, res, next) {
        let params = HttpTools_1.HttpTools.getBodyParams(req, {
            path: {
                type: 'string'
            },
            dest: {
                type: 'string'
            },
            overwrite: {
                type: 'boolean',
                default: false
            }
        });
        this.logger.info('moveFile path=' + params.path + ', dest=' + params.dest);
        fs.pathExists(params.path)
            .then(pathExits => {
            if (!pathExits) {
                throw new Errors.HttpError(params.path + ' does not exist', 400);
            }
            return fs.pathExists(params.dest);
        })
            .then(destExists => {
            if (destExists && !params.overwrite) {
                throw new Errors.HttpError('Destination ' + params.dest + ' already exists', 400);
            }
            let dir = p.normalize(p.dirname(params.dest));
            if (!fs.pathExistsSync(dir)) {
                throw new Errors.HttpError('Destination directory' + dir + ' does not exist', 400);
            }
            return fs.move(params.path, params.dest, { overwrite: params.overwrite });
        })
            .then(() => {
            res.status(200).json({ path: params.path, dest: params.dest });
        })
            .catch(err => {
            next(err);
        });
    }
    copyFile(req, res, next) {
        let params = HttpTools_1.HttpTools.getBodyParams(req, {
            path: {
                type: 'string'
            },
            dest: {
                type: 'string'
            }
        });
        this.logger.info('copyFile path=' + params.path + ', dest=' + params.dest);
        fs.pathExists(params.path)
            .then(pathExits => {
            if (!pathExits) {
                throw new Errors.HttpError(params.path + ' does not exist', 400);
            }
            let sourceStat = Files_1.Files.getFileStat(params.path, false);
            if (!sourceStat.isFile) {
                throw new Errors.HttpError(params.path + ' is not a file', 400);
            }
            return fs.pathExists(params.dest);
        })
            .then(destExists => {
            if (destExists) {
                let destStat = Files_1.Files.getFileStat(params.dest, false);
                if (!destStat.isFile) {
                    throw new Errors.HttpError('Destination ' + params.dest + ' is not a file', 400);
                }
            }
            let dir = p.normalize(p.dirname(params.dest));
            if (!fs.pathExistsSync(dir)) {
                throw new Errors.HttpError('Destination directory' + dir + ' does not exist', 400);
            }
            return fs.copy(params.path, params.dest, { errorOnExist: true, overwrite: true });
        })
            .then(() => {
            res.status(200).json({ path: params.path, dest: params.dest });
        })
            .catch(err => {
            next(err);
        });
    }
    uncompressFile(req, res, next) {
        let params = HttpTools_1.HttpTools.getBodyParams(req, {
            path: {
                type: 'string'
            },
            destDir: {
                type: 'string',
                default: null
            }
        });
        let destDir = params.destDir;
        if (!destDir)
            destDir = p.dirname(params.path);
        destDir = p.normalize(destDir);
        this.logger.info('uncompressFile path=' + params.path + ', destDir=' + destDir);
        fs.pathExists(params.path)
            .then(pathExits => {
            if (!pathExits) {
                throw new Errors.HttpError(params.path + ' does not exist', 400);
            }
            let sourceStat = Files_1.Files.getFileStat(params.path, false);
            if (!sourceStat.isFile) {
                throw new Errors.HttpError(params.path + ' is not a file', 400);
            }
            if (!sourceStat.name.endsWith('.zip'))
                throw new Errors.HttpError(params.path + ' is not a zip file', 400);
            return fs.pathExists(destDir);
        })
            .then(destExists => {
            if (destExists) {
                let destStat = Files_1.Files.getFileStat(destDir, false);
                if (!destStat.isDir) {
                    throw new Errors.HttpError('Destination ' + destDir + ' is not a directory', 400);
                }
            }
            else {
                throw new Errors.HttpError("Destination directory '" + destDir + "' does not exist", 400);
            }
            try {
                let zip = new streamZip({
                    file: params.path
                });
                zip.on('ready', () => {
                    zip.extract(null, destDir, (err) => {
                        if (err) {
                            this.logger.error("uncompressFile " + params.path, err);
                            next(err);
                        }
                        else {
                            let r = {
                                path: params.path,
                                destDir: destDir
                            };
                            res.status(200).json(r);
                        }
                        zip.close();
                    });
                });
                zip.on('error', (err) => {
                    this.logger.error("uncompressFile " + params.path, err);
                    next(err);
                });
            }
            catch (err) {
                this.logger.error("uncompressFile " + params.path, err);
                next(err);
            }
        })
            .catch(err => {
            this.logger.error("uncompressFile " + params.path, err);
            next(err);
        });
    }
    fileinfo(req, res, next) {
        let params = HttpTools_1.HttpTools.getQueryParams(req, {
            path: {
                type: 'string'
            }
        });
        this.logger.info('fileinfo path=' + params.path);
        fs.pathExists(params.path)
            .then(exists => {
            if (!exists) {
                throw new Error(params.path + ' does not exist');
            }
            let stat = Files_1.Files.getFileStat(params.path, true);
            res.status(200).json(stat);
        })
            .catch(err => {
            next(err);
        });
    }
    fileExists(req, res, next) {
        let params = HttpTools_1.HttpTools.getQueryParams(req, {
            path: {
                type: 'string'
            }
        });
        fs.pathExists(params.path)
            .then(exists => {
            res.status(200).json({ result: exists });
        })
            .catch(err => {
            next(err);
        });
    }
    list(req, res, next) {
        let params = HttpTools_1.HttpTools.getQueryParams(req, {
            path: {
                type: 'string'
            },
            recursive: {
                default: false,
                type: 'boolean'
            },
            maxResults: {
                default: 50000,
                type: 'integer'
            },
            filter: {
                default: '*',
                type: 'string'
            }
        });
        this.logger.info('list path=' + params.path + ', filter=' + params.filter + ', recursive=' + params.recursive + ',maxResults=' + params.maxResults);
        this.tools.findFiles(params.path, params.filter, params.recursive, params.maxResults)
            .then((result) => {
            res.status(200).json(result);
        })
            .catch(err => {
            next(err);
        });
    }
}
exports.Tplugin = Tplugin;
//# sourceMappingURL=Tplugin.js.map