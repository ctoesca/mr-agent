
import AdmZip = require('adm-zip');
import fs = require('fs-extra');
import p = require('path');
import express = require('express')
import parseArgs = require('minimist')
import bunyan = require('bunyan')
import Bluebird = require('bluebird')

import * as child_process from 'child_process'
import * as utils from '../utils'
import EventEmitter = require('events');
import {HttpTools} from '../utils/HttpTools'
import {Application}  from '../Application'
import {WorkerApplication}  from '../WorkerApplication'
import * as Errors from '../Errors'
import {ChildProcess} from '../utils/ChildProcess'

export class Updater extends EventEmitter {

	public static updateIsRunning = false

	protected static excludedFromBackup = ['tmp', '.svn', 'logs', 'data', '.git', '.nyc_output', 'coverage', 'last_release']
	protected static excludedFromUpdate = ['tmp', 'conf', '.svn', 'logs', 'data', '.git', '.nyc_output', 'coverage']
	public application: WorkerApplication = null
	public logger: bunyan = null;
	

	constructor(application: WorkerApplication) {

		super()
		this.application = application
		this.logger = this.application.getLogger(this.constructor.name)

	}
	protected waitPurgeCompleted( waitPurgeCompletedStartDate = new Date().getTime()): any {

		let waitingTime: number = (new Date().getTime() -  waitPurgeCompletedStartDate ) / 1000 //sec
		let maxWait = 300

		if (waitingTime > maxWait) {
			return Promise.reject("Purge is running from "+maxWait+" sec.")
		} else {

			let purgeFlagFile = this.application.config.tmpDir+"/purgeIsRunning"
			if (fs.existsSync(purgeFlagFile)) {
				this.logger.warn("UPDATE: une purge est en cours: attente ...")
				
				return Bluebird.delay(5000)
				.then(() => {
					return this.waitPurgeCompleted(waitPurgeCompletedStartDate)
				})

			} else {
				return Promise.resolve()
			}
		}

	}

	public onUpdateRequest(req: express.Request, res: express.Response, next: express.NextFunction) {

		if (Updater.updateIsRunning) {
			throw new Errors.HttpError("Une mise à jour est déjà en cours d'exécution", 403);
		}

		process.send({
			event: {
				name: 'UPDATE_STARTED'
			}
		});

		this.waitPurgeCompleted()
		.then( () => {
			this.logger.info('UPDATE...');
			Updater.updateIsRunning = true; // !! updateIsRunning is not shared between workers !
			return HttpTools.saveUploadedFile(req, res, next)
		})
		.then( (result: any) => {


			if (result.files.length === 0) {
				throw new Errors.HttpError('Uploaded file expected');
			} else {
				let zipPath = result.files[0].path
				this.logger.info('Uploaded file saved to ' + zipPath, result)
				this.execUpdate( zipPath )
				res.status(200).send('Update started');
			}
		})
		.then( () => {
			this.logger.info('Update step-1 completed')
		})
		.finally( () => {
			Updater.updateIsRunning = false;
		})
		.catch( (err: any) => {
			this.logger.error('onUpdateRequest', err.toString())
			next( new Errors.HttpError(err.toString(), 500) )
		})
		
	}

	public execUpdate(zipPath: string) {

		let updateTmpDir = p.normalize(this.application.getTmpDir() + '/update-' + new Date().getTime())
		let newVersionCopyDir =  p.normalize(updateTmpDir + '/new-version')
		let backupDir = p.normalize(updateTmpDir + '/backup')

		this.logger.info('Updating - step-1...')

		this.uncompressPackage(zipPath, newVersionCopyDir)
		//fs.removeSync(zipPath)

		this.backup(backupDir)
		this.logger.info(zipPath + ' removed')


		let backupNodePath: string

		if (utils.isWin()) {
			backupNodePath = backupDir + '/node/node.exe';
		} else {
			backupNodePath = backupDir + '/node/node';
		}
		if (!fs.pathExistsSync(backupNodePath)) {
			this.logger.error('execUpdate: ' + backupNodePath + ' does not exists')
			throw 'Cannot exec step2: node path does not exists. Update failed'
		}

		let args = [ p.normalize(backupDir + '/dist/autoUpdate/update-step2'), '--updateDir', updateTmpDir, '--appDir', this.getAppDir(), '--appUrl', this.application.getUrl() ]
		let thisProcessArgs = parseArgs(process.argv.slice(2));
		if (thisProcessArgs.c) {
			args.push('-c')
			args.push(thisProcessArgs.c)
		}

		fs.writeFileSync(updateTmpDir + '/step2.bat', backupNodePath + ' ' + args.join(' ') + ' 1>' + this.getAppDir() + '/logs/step2.out 2>' + this.getAppDir() + '/logs/step2.err')
		if (!utils.isWin()) {
			child_process.execSync('chmod 755 ' + updateTmpDir + '/step2.bat')
		}

		this.logger.info('EXECUTING step2: ' + backupNodePath + ' ' + args.join(' '))


		this.logger.info('Starting - step-2... application will stop')
		let child = child_process.spawn(updateTmpDir + '/step2.bat', [], {
			detached: true,
			stdio: 'ignore'
		});
		child.unref()
	}

	/************  STEP 2 ************/

	public execUpdateStep2(appDir: string, updateDir: string, appUrl: string) {

		return this.stopApp(appDir, appUrl)

		.then( () => {
			return this.remove(appDir)
		})

		.then( result => {
			return this.copy(updateDir, appDir)
		})

		.then( result => {
			return this.startApp(appDir)
		})

		.then( () => {
			this.logger.info('Update complete')

			this.logger.info('Removing update directory...')

			let cmd: string
			let args: string[]
			if (utils.isWin()) {
				cmd = 'cmd'
				args = ['/C', 'rd', '/s', '/q', updateDir]
			} else {
				cmd = 'rm'
				args = ['-rf', updateDir]
			}
			let child = child_process.spawn(cmd, args, {
				detached: true,
				stdio: 'ignore'
			})

			child.unref()

		})

		.catch(err => {

			this.logger.error(err.toString())
		})
	}

	protected getAppDir() {
		return p.normalize( Application.applicationDirPath + '/..')
	}

	/************  STEP 1 ************/

	protected backup(backupDir: string) {
		try {
			let appDir = this.getAppDir()

			this.logger.info('backup started ' + appDir + ' --> ' + backupDir)

			if (fs.pathExistsSync(backupDir)) {
				fs.removeSync( backupDir )
			}

			fs.readdirSync(appDir).filter( (file) => {
				return (Updater.excludedFromBackup.indexOf(file) === -1)
			}).forEach((file) => {
				let path = appDir + '/' + file
				this.logger.info('copying ' + file + ' ...')
				fs.copySync(path, backupDir + '/' + file)
			});

			if (!utils.isWin()) {
				child_process.execSync('chmod 700 ' + backupDir + '/bin/*')
				child_process.execSync('chmod 700 ' + backupDir + '/node/*')
				child_process.execSync('chmod 700 ' + backupDir + '/node_modules/.bin/*')
			}

			this.logger.info('backup completed')

		} catch (err) {
			this.logger.error(err)
			throw err
		}
	}

	protected uncompressPackage(zipPath: string, newVersionCopyDir: string) {

		try {
			this.logger.info('uncompress ' + zipPath + ' --> ' + newVersionCopyDir + ' started ...')
			if (fs.pathExistsSync(newVersionCopyDir)) {
				fs.removeSync( newVersionCopyDir )
				this.logger.info('updateDir deleted (' + newVersionCopyDir + ')')
			}
			let zip = new AdmZip(zipPath);
			zip.extractAllTo(newVersionCopyDir, true);

			this.logger.info('uncompress zip completed')
		} catch (err) {
			this.logger.error(err)
			throw err
		}

	}

	protected stopApp(appDir: string, appUrl: string): Bluebird<any> {


		this.logger.info('Stopping... ')

		if (utils.isWin()) {
			return ChildProcess.execCmd('net', ['stop', this.application.serviceName])
			.then( (result: any) => {
				if (result.exitCode > 0) {
					throw 'Failed to stop agent: ' + result.stderr
				}
			})
			.delay(10000)
			.catch( (err: any) => {
				throw 'Echec stop' + err.toString()	
			})
		} else {
			let cmd = appDir + '/bin/agent.sh';
			let args = ['stop'];
			let child = child_process.spawn(cmd, args, {
				detached: true,
				windowsVerbatimArguments : true,
				stdio: 'ignore'
			});

			child.unref()
			return Bluebird
			.delay(10000)
						
		}

	}
	protected startApp(appDir: string): Bluebird<any> {

		let cmd: string
		let args: string[]

		this.logger.info('Starting agent ...')

		if (utils.isWin()) {
			return ChildProcess.execCmd('net', ['start', this.application.serviceName])
			.then( (result: any) => {
				if (result.exitCode > 0) {
					throw 'Failed to start agent: ' + result.stderr
				} else {
					this.logger.info('Agent started.')
				}
			})
			.catch( (err: any) => {
				throw 'Echec start' + err.toString()	
			})
		} else {
			cmd = appDir + '/bin/agent.sh';
			args = ['start'];
			let child = child_process.spawn(cmd, args, {
				detached: true,
				windowsVerbatimArguments : true,
				stdio: 'ignore'
			});

			child.unref()
			return Bluebird.resolve()
		}

	}


	protected remove(appDir: string) {

		try {
			this.logger.info('Removing old version...')
			let errors = 0

			fs.readdirSync(appDir).filter( (file) => {
				return (Updater.excludedFromUpdate.indexOf(file) === -1)
			}).forEach( (file) => {
				let path = appDir + '/' + file
				this.logger.info('removing ' + path + ' ...')
				try {
					// agent.exe genere une erreur (not permitted) mais ce n'est pas grave
					fs.removeSync(path)
				} catch (err) {
					errors ++
					this.logger.error("Echec suppression "+path+" : "+err.toString())
				}
			});
			if (errors === 0) {
				this.logger.info('Old version removed successfully')
			} else {
				this.logger.warn(errors + ' errors removing old version')
			}

		} catch (err) {
			this.logger.error(err)
			throw err;
		}
	}

	protected copy(updateDir: string, appDir: string) {

		this.logger.info('Copying new version ...')
		try {
			fs.readdirSync(updateDir + '/new-version').filter( (file) => {
				return (Updater.excludedFromUpdate.indexOf(file) === -1)
			}).forEach( (file) => {
				let source = updateDir + '/new-version/' + file
				let dest = appDir + '/' + file
				this.logger.info('copying ' + source + ' --> ' + dest + ' ...')
				fs.copySync(source, dest, {
					filter: function(_src: string, _dest: string) {

						if ( (file === 'bin') && (p.basename(_dest) === 'agent.exe')) {
							return false
						} else {
							return true
						}
					}.bind(this)
				})
			});

			try {
				fs.copySync(updateDir + '/new-version/bin/agent.exe', appDir + '/bin/agent.exe')
			} catch (err) {
				this.logger.warn('copySync agent.exe ' + err.toString())
			}

			if (!utils.isWin()) {
				child_process.execSync('chmod 755 ' + appDir + '/bin/*')
				child_process.execSync('chmod 755 ' + appDir + '/node/*')
				child_process.execSync('chmod 755 ' + appDir + '/node_modules/.bin/*')
			}

			this.logger.info('New version copied successfully')

		} catch (err) {
			this.logger.error(err)
			throw err;
		}

	}
}


