"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AdmZip = require("adm-zip");
const fs = require("fs-extra");
const p = require("path");
const request = require("request-promise");
const parseArgs = require("minimist");
const child_process = require("child_process");
const utils = require("../utils");
const EventEmitter = require("events");
const HttpTools_1 = require("../utils/HttpTools");
const Application_1 = require("../Application");
const Errors = require("../Errors");
class Updater extends EventEmitter {
    constructor(application) {
        super();
        this.application = null;
        this.logger = null;
        this.application = application;
        this.logger = this.application.getLogger(this.constructor.name);
    }
    onUpdateRequest(req, res, next) {
        if (Updater.updateIsRunning) {
            throw new Errors.HttpError("Une mise à jour est déjà en cours d'exécution", 403);
        }
        this.logger.info('UPDATE...');
        Updater.updateIsRunning = true;
        HttpTools_1.HttpTools.saveUploadedFile(req, res, next)
            .then((result) => {
            if (result.files.length === 0) {
                throw new Errors.HttpError('Uploaded file expected');
            }
            else {
                let zipPath = result.files[0].path;
                this.logger.info('Uploaded file saved to ' + zipPath, result);
                this.execUpdate(zipPath);
                res.status(200).send('Update started');
            }
        })
            .then(() => {
            this.logger.info('Update step-1 completed');
        })
            .finally(() => {
            Updater.updateIsRunning = false;
        })
            .catch((err) => {
            this.logger.error('onUpdateRequest', err.toString());
            next(new Errors.HttpError(err.toString(), 500));
        });
    }
    execUpdate(zipPath) {
        let updateTmpDir = p.normalize(this.application.getTmpDir() + '/update-' + new Date().getTime());
        let newVersionCopyDir = p.normalize(updateTmpDir + '/new-version');
        let backupDir = p.normalize(updateTmpDir + '/backup');
        this.logger.info('Updating - step-1...');
        this.backup(backupDir);
        this.uncompressPackage(zipPath, newVersionCopyDir);
        fs.removeSync(zipPath);
        this.logger.info(zipPath + ' removed');
        let nodePath = backupDir + '/node/node';
        let args = [p.normalize(backupDir + '/dist/autoUpdate/update-step2'), '--updateDir', updateTmpDir, '--appDir', this.getAppDir(), '--appUrl', this.application.getUrl()];
        this.logger.info('EXECUTING step2: ' + nodePath + ' ' + args.join(' '));
        let thisProcessArgs = parseArgs(process.argv.slice(2));
        if (thisProcessArgs.c) {
            args.push('-c');
            args.push(thisProcessArgs.c);
        }
        if (!fs.pathExistsSync(nodePath)) {
            this.logger.error('execUpdate: ' + nodePath + ' does not exists');
            throw 'Cannot exec step2: node path does not exists. Update failed';
        }
        this.logger.info('Starting - step-2... application will stop');
        let child = child_process.spawn(nodePath, args, {
            detached: true,
            stdio: 'ignore'
        });
        child.unref();
    }
    execUpdateStep2(appDir, updateDir, appUrl) {
        return this.stopApp(appUrl)
            .then(() => {
            this.remove(appDir);
            this.copy(updateDir, appDir);
            this.startApp(appDir);
        })
            .then(() => {
            this.logger.info('Update complete');
            this.logger.info('Removing update directory...');
            let cmd;
            let args;
            if (utils.isWin()) {
                cmd = 'cmd';
                args = ['/C', 'rd', '/s', '/q', updateDir];
            }
            else {
                cmd = 'rm';
                args = ['-rf', updateDir];
            }
            let child = child_process.spawn(cmd, args, {
                detached: true,
                stdio: 'ignore'
            });
            child.unref();
        })
            .catch(err => {
            this.logger.error(err.toString());
        });
    }
    getAppDir() {
        return p.normalize(Application_1.Application.applicationDirPath + '/..');
    }
    backup(backupDir) {
        let appDir = this.getAppDir();
        this.logger.info('backup started ' + appDir + ' --> ' + backupDir);
        if (fs.pathExistsSync(backupDir)) {
            fs.removeSync(backupDir);
        }
        fs.readdirSync(appDir).filter((file) => {
            return (Updater.excludedFromBackup.indexOf(file) === -1);
        }).forEach((file) => {
            let path = appDir + '/' + file;
            this.logger.info('copying ' + file + ' ...');
            fs.copySync(path, backupDir + '/' + file);
        });
        if (!utils.isWin()) {
            child_process.execSync('chmod 700 ' + backupDir + '/bin/*');
            child_process.execSync('chmod 700 ' + backupDir + '/node/*');
            child_process.execSync('chmod 700 ' + backupDir + '/node_modules/.bin/*');
        }
        this.logger.info('backup completed');
    }
    uncompressPackage(zipPath, newVersionCopyDir) {
        this.logger.info('uncompress ' + zipPath + ' --> ' + newVersionCopyDir + ' started ...');
        if (fs.pathExistsSync(newVersionCopyDir)) {
            fs.removeSync(newVersionCopyDir);
            this.logger.info('updateDir deleted (' + newVersionCopyDir + ')');
        }
        let zip = new AdmZip(zipPath);
        zip.extractAllTo(newVersionCopyDir, true);
        this.logger.info('uncompress zip completed');
    }
    stopApp(appUrl) {
        let url = appUrl + '/api/admin/stop';
        this.logger.info('Stopping... call ' + url);
        let opt = {
            url: url,
            method: 'GET',
            json: true
        };
        return request(opt)
            .then(() => {
            this.logger.info('Stop command sent...');
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve();
                }, 5000);
            });
        })
            .catch((err) => {
            this.logger.error('STOP failed : ' + err.toString());
        });
    }
    startApp(appDir) {
        let cmd;
        let args;
        if (utils.isWin()) {
            cmd = appDir + '/bin/mr-agent.bat';
            args = [];
        }
        else {
            cmd = appDir + '/bin/mr-agent.sh';
            args = ['start'];
        }
        let child = child_process.spawn(cmd, args, {
            detached: true,
            windowsVerbatimArguments: true,
            stdio: 'ignore'
        });
        child.unref();
    }
    remove(appDir) {
        this.logger.info('Removing old version...');
        fs.readdirSync(appDir).filter((file) => {
            return (Updater.excludedFromUpdate.indexOf(file) === -1);
        }).forEach((file) => {
            let path = appDir + '/' + file;
            this.logger.info('removing ' + path + ' ...');
            fs.removeSync(path);
        });
        this.logger.info('Old version removed successfully');
    }
    copy(updateDir, appDir) {
        this.logger.info('Copying new version ...');
        fs.readdirSync(updateDir + '/new-version').filter((file) => {
            return (Updater.excludedFromUpdate.indexOf(file) === -1);
        }).forEach((file) => {
            let source = updateDir + '/new-version/' + file;
            let dest = appDir + '/' + file;
            this.logger.info('copying ' + source + ' --> ' + dest + ' ...');
            fs.copySync(source, dest);
        });
        if (!utils.isWin()) {
            child_process.execSync('chmod 700 ' + appDir + '/bin/*');
            child_process.execSync('chmod 700 ' + appDir + '/node/*');
            child_process.execSync('chmod 700 ' + appDir + '/node_modules/.bin/*');
        }
        this.logger.info('New version copied successfully');
    }
}
Updater.updateIsRunning = false;
Updater.excludedFromBackup = ['tmp', '.svn', 'logs', 'data', '.git', '.nyc_output', 'coverage', 'last_release'];
Updater.excludedFromUpdate = ['tmp', 'conf', '.svn', 'logs', 'data', '.git', '.nyc_output', 'coverage', 'last_release'];
exports.Updater = Updater;
//# sourceMappingURL=Updater.js.map