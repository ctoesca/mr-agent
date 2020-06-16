"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tplugin = void 0;
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
            this.config.maxUploadSize = 300 * 1024 * 1024 * 1024;
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
        this.app.post('/mergeFileParts', this.mergeFileParts.bind(this));
        this.app.post('/uploadPart', this.uploadPart.bind(this));
        this.app.get('/downloadFilePart', this.downloadFilePart.bind(this));
    }
    downloadFilePart(req, res, next) {
        let params = HttpTools_1.HttpTools.getQueryParams(req, {
            path: {
                type: 'string'
            },
            part: {
                type: 'integer'
            },
            blocsize: {
                default: 1024 * 1024 * 1024,
                type: 'integer'
            }
        });
        if (!fs.existsSync(params.path)) {
            this.logger.warn('downloadFilePart path=' + params.path + ': fichier inexistant');
            throw new Errors.NotFound('Le fichier ' + params.path + ' n\'existe pas');
        }
        res.set('x-part', params.part);
        res.set('x-blocsize', params.blocsize);
        Files_1.Files.getFilePart(params.path, params.part, params.blocsize)
            .then((result) => {
            let readStream = result.stream;
            res.set('x-total-size', result.totalSize);
            res.set('x-start-position', result.start);
            res.set('x-end-position', result.end);
            res.attachment(p.basename(params.path) + '-part' + params.part);
            readStream.pipe(res);
        })
            .catch((err) => {
            next(err);
        });
    }
    getUploadPartDirectory(uid, createIfNotExists = false) {
        let r = this.application.getTmpDir() + '/uploads/parts-' + uid;
        if (createIfNotExists) {
            if (!fs.existsSync(r))
                fs.mkdirpSync(r);
        }
        return r;
    }
    uploadPart(req, res, next) {
        let params = HttpTools_1.HttpTools.getQueryParams(req, {
            uid: {
                type: 'string'
            }
        });
        this.logger.info('Upload part ' + params.uid + ' ...');
        let uploadedFile = null;
        let uploadDir = this.getUploadPartDirectory(params.uid, true);
        let opt = {
            maxUploadSize: this.config.maxUploadSize,
            uploadDir: uploadDir,
            preserveFilename: true
        };
        return HttpTools_1.HttpTools.saveUploadedFile(req, res, next, opt)
            .then((result) => {
            if (result.files.length === 0) {
                throw new Errors.BadRequest('No file uploaded');
            }
            else {
                uploadedFile = result.files[0];
            }
        })
            .then(() => {
            this.logger.info('Upload part ' + params.uid + ' saved :' + uploadedFile.path);
            let r = {
                uploadedFile: uploadedFile
            };
            res.status(200).json(r);
        })
            .catch((err) => {
            next(err);
        });
    }
    mergeFileParts(req, res, next) {
        let params = HttpTools_1.HttpTools.getBodyParams(req, {
            files: {
                type: 'string'
            },
            destFilepath: {
                type: 'string'
            }
        });
        this.logger.info("mergeUploadedParts " + params.destFilepath + " ...");
        return Files_1.Files.mergeFiles(params.files, params.destFilepath)
            .then((result) => {
            this.logger.info("Success mergeUploadedParts " + params.uid + ", destFilepath: " + params.destFilepath);
            res.json(result);
        })
            .catch((err) => {
            next(err);
        });
    }
    upload(req, res, next) {
        let params = {};
        var onBeforeSaveFile = (fields, opt, filename) => {
            try {
                for (let k in fields) {
                    params[k] = fields[k].val;
                }
                params = utils.parseParams(params, {
                    path: {
                        type: 'string'
                    },
                    overwrite: {
                        default: true,
                        type: 'boolean'
                    },
                    directUpload: {
                        default: false,
                        type: 'boolean'
                    },
                    start: {
                        default: null,
                        type: 'integer'
                    }
                });
                if (params.start !== null) {
                    params.overwrite = true;
                    params.directUpload = true;
                }
                this.logger.info('Upload path=' + params.path + ' filename=' + filename + ', start=' + params.start + ', overwrite=' + params.overwrite + ' ...');
                let uploadDir = p.normalize(p.dirname(params.path));
                if (!fs.pathExistsSync(uploadDir)) {
                    throw new Errors.BadRequest(uploadDir + ' upload directory does not exist');
                }
                if (fs.pathExistsSync(params.path)) {
                    if (!Files_1.Files.getFileStat(params.path).isFile) {
                        throw new Errors.BadRequest('Upload destination is directory: ' + params.path);
                    }
                    if (!params.overwrite) {
                        throw new Errors.BadRequest('File already exist: ' + params.path + ' (use overwrite option)');
                    }
                }
                let checkSizePromise;
                if (params.directUpload) {
                    opt.path = params.path;
                    checkSizePromise = Promise.resolve();
                }
                else {
                    checkSizePromise = HttpTools_1.HttpTools.checkUploadSize(params.path, req, this.config.maxUploadSize);
                }
                opt.start = params.start;
                return checkSizePromise
                    .then(() => {
                    return opt;
                });
            }
            catch (err) {
                return Promise.reject(err);
            }
        };
        let uploadedFile = null;
        return HttpTools_1.HttpTools.saveUploadedFile(req, res, next, {
            maxUploadSize: this.config.maxUploadSize,
            onBeforeSaveFile: onBeforeSaveFile,
        })
            .then((result) => {
            if (result.files.length === 0) {
                throw new Errors.BadRequest('No file uploaded');
            }
            else {
                uploadedFile = result.files[0];
                if (!params.directUpload)
                    return fs.move(uploadedFile.path, params.path, { overwrite: params.overwrite });
            }
        })
            .then(() => {
            this.logger.info('Succes upload ' + params.path + ', start=' + params.start + ', overwrite=' + params.overwrite);
            let r = {
                path: params.path,
                file: Files_1.Files.getFileStat(params.path, true)
            };
            res.status(200).json(r);
        })
            .finally(() => {
            if (uploadedFile && !params.directUpload && (params.start === null)) {
                if (fs.existsSync(uploadedFile.path))
                    fs.removeSync(uploadedFile.path);
            }
        })
            .catch((err) => {
            this.logger.error(err);
            next(err);
        });
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
            throw new Errors.BadRequest("Valeur incorrect pour la propriété 'type'. Valeurs possible: 'shell'|'javascript'", 412);
        }
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
        this.logger.info('download path=' + params.path + ',compress=' + params.compress + " ...");
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
                throw new Errors.BadRequest(fullPath + ' already exists');
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
                throw new Errors.BadRequest(params.path + ' does not exist');
            }
            return fs.pathExists(params.dest);
        })
            .then(destExists => {
            if (destExists && !params.overwrite) {
                throw new Errors.BadRequest('Destination ' + params.dest + ' already exists');
            }
            let dir = p.normalize(p.dirname(params.dest));
            if (!fs.pathExistsSync(dir)) {
                throw new Errors.BadRequest('Destination directory ' + dir + ' does not exist');
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
                throw new Errors.BadRequest(params.path + ' does not exist');
            }
            let sourceStat = Files_1.Files.getFileStat(params.path, false);
            if (!sourceStat.isFile) {
                throw new Errors.BadRequest(params.path + ' is not a file');
            }
            return fs.pathExists(params.dest);
        })
            .then(destExists => {
            if (destExists) {
                let destStat = Files_1.Files.getFileStat(params.dest, false);
                if (!destStat.isFile) {
                    throw new Errors.BadRequest('Destination ' + params.dest + ' is not a file');
                }
            }
            let dir = p.normalize(p.dirname(params.dest));
            if (!fs.pathExistsSync(dir)) {
                throw new Errors.BadRequest('Destination directory ' + dir + ' does not exist');
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
                throw new Errors.BadRequest(params.path + ' does not exist');
            }
            let sourceStat = Files_1.Files.getFileStat(params.path, false);
            if (!sourceStat.isFile) {
                throw new Errors.BadRequest(params.path + ' is not a file');
            }
            if (!sourceStat.name.endsWith('.zip'))
                throw new Errors.BadRequest(params.path + ' is not a zip file');
            return fs.pathExists(destDir);
        })
            .then(destExists => {
            if (destExists) {
                let destStat = Files_1.Files.getFileStat(destDir, false);
                if (!destStat.isDir) {
                    throw new Errors.BadRequest('Destination ' + destDir + ' is not a directory');
                }
            }
            else {
                throw new Errors.BadRequest("Destination directory '" + destDir + "' does not exist");
            }
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
                throw new Errors.BadRequest(params.path + ' does not exist');
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