

import {ThttpPlugin} from '../ThttpPlugin'
import {SshError} from './SshError'
import {WorkerApplication as Application}  from '../../WorkerApplication'
import {Files} from '../../utils/Files'
import {HttpTools} from '../../utils/HttpTools'
import fs = require('fs-extra')
import Ssh2 = require('ssh2')
import express = require('express')
import p = require('path')
import * as Errors from '../../Errors'
import * as Promise from 'bluebird'
import SftpError from './SftpError'
import SshConnection from './SshConnection'
import bodyParser = require('body-parser');

/*
curl -X POST -H "Content-Type: application/json" "http://localhost:3003/ssh/exec" -d "{\"username\":\"nagios\",\"password\":\".....\",\"host\":\"cdxlan017\",\"port\":22,\"script\":\"ls\"}"
=>>  {"std":[{"type":0,"data":"conf_nagios\ndead.letter\nicinga.log\nicinga.log.gz\ntest.pl\ntmp"}],"exitCode":0}

curl -X POST -H "Content-Type: application/json" "http://localhost:3003/ssh/exec" -d "{\"script\":\"ls\",\"destinations\":[{\"username\":\"nagios\",\"password\":\"......\",
\"host\":\"cdxlan017\",\"port\":22},{\"username\":\"nagios\",\"password\":\"nagios\",\"host\":\"cdxlan017\",\"port\":22}]}"
*/

export class Tplugin extends ThttpPlugin {

	protected sshKeysDir: string = null
	protected defaultPort = 22
	protected connectTimeout = 10000


	constructor(application: Application, config: any) {

		super(application, config);

		if (this.config.sshKeysDir) {
			this.sshKeysDir = this.config.sshKeysDir;
		} else {
			this.sshKeysDir = Application.getConfigDir() + '/sshKeys';
		}

	}

	public install() {

		super.install();

		this.app.use( bodyParser.json({
			limit: '500mb'
		}));

		this.app.post('/exec', this.exec.bind(this));
		this.app.post('/execMulti', this.execMulti.bind(this));
		this.app.get('/download', this.download.bind(this));
		this.app.post('/upload', this.upload.bind(this));
		this.app.post('/checkLogin', this.checkLogin.bind(this));
		this.app.post('/checkLogins', this.checkLogins.bind(this));

	}

	public upload(req: express.Request, res: express.Response, next: express.NextFunction) {

		let params = HttpTools.getQueryParams(req, {
			path: {
				type: 'string'
			},
			host: {
				type: 'string'
			},
			port: {
				default: this.defaultPort,
				type: 'integer'
			},
			username: {
				type: 'string'
			},
			password: {
				default: null,
				type: 'string'
			},
			overwrite: {
				default: true,
				type: 'boolean'
			},
			key: {
				default: null,
				type: 'string'
			},
			passphrase: {
				default: null,
				type: 'string'
			}
		})

		let uploadedFile: any = null

		HttpTools.saveUploadedFile(req, res, next)
		.then( (result: any) => {

			if (result.files.length === 0) {
				throw new Errors.HttpError('No file uploaded', 400)
			} else {
				uploadedFile = result.files[0]
				this.logger.info('Upload File [' + uploadedFile.name + ']');

				if (!params.overwrite) {
					return this.remoteFileExists(params.host, params.username, params.password, params.key, params.passphrase, params.path, params.port)
				} else {
					return Promise.resolve(null)
				}
			}
		})
		.then((fileExists: boolean = null) => {
			if (!fileExists) {
				return this.scpSend(params.host, params.username, params.password, params.key, params.passphrase, uploadedFile.path, params.path, params.port)
			} else {
				throw new Errors.HttpError('File already exists: ' + params.path + ' (use \'overwrite\' option)', 400)
			}
		})
		.then((result: any) => {

			this.logger.info('scpSend OK to ' + params.host + params.path);

			let r: any = {
				host: params.host,
				files: [{
					name: uploadedFile.name,
					path: params.path,
					size: Files.getFileSize(uploadedFile.path)
				}]
			}

			res.status(200).json(r);
		})
		.finally(() => {
			if (uploadedFile.path) {
				this.removeTempFileSync( uploadedFile.path )
			}
		})
		.catch( (err: any) => {
			next(err);
		})

	}

	public remoteFileExists(host: string, username: string, password: string, key: string, passphrase: string, remotePath: string, port: number) {
		let filename = p.basename(remotePath)
		let rep = p.dirname(remotePath)

		let script = `cd ${rep}
		if [ $? -ne 0 ]; then
		exit 99
		fi
		ls ${filename}
		`

		return this._exec({
			host: host,
			username: username,
			password: password,
			key : key ,
			passphrase: passphrase,
			script: script,
			port: port,
			logError: true,
			pty: false
		})
		.then( (result: any) => {
			if (result.exitCode === 99) {
				throw 'Cannot access directory : ' + result.stderr;
			}
			return (result.exitCode === 0)
		})

	}

	public download(req: express.Request, res: express.Response, next: express.NextFunction) {



		let params = HttpTools.getQueryParams(req, {
			path: {
				type: 'string'
			},
			compress: {
				default: false,
				type: 'boolean'
			},
			host: {
				type: 'string'
			},
			port: {
				default: this.defaultPort,
				type: 'integer'
			},
			username: {
				type: 'string'
			},
			password: {
				default: null,
				type: 'string'
			},
			overwrite: {
				default: true,
				type: 'boolean'
			},
			key: {
				default: null,
				type: 'string'
			},
			passphrase: {
				default: null,
				type: 'string'
			}
		})

		this.logger.info('ssh download remotePath=' + params.path + ' on ' + params.host + ':' + params.port + ',compress=' + params.compress);

		let filename = Files.getFileName(params.path);
		let localdir = this.tmpDir + '/' + Math.random();
		let localPath = localdir + '/' + filename;

		fs.ensureDirSync(localdir);

		this.scpGet(params.host, params.username, params.password, params.key, params.passphrase, localPath, params.path, params.port)
		.then( () => {
			if (params.compress) {

				let zipFileName = filename + '.zip';

				HttpTools.sendZipFile(res, next, localPath, zipFileName)
				.finally( () => {
					this.removeTempDir(localdir);
				})

			} else {
				res.attachment(filename).sendFile(filename, {
					root: localdir
				}, (err: any) => {
					this.removeTempDir(localdir);
					if (err) {
						throw new Errors.HttpError( err.toString() )
					}
				})
			}
		})
		.catch( err => {
			next(err)
		})

	}

	/*
	* POST /ssh/exec
	*/
	public exec(req: express.Request, res: express.Response, next: express.NextFunction) {

		let params = HttpTools.getBodyParams(req, {
			host: {
				type: 'string'
			},
			port: {
				default: this.defaultPort,
				type: 'integer'
			},
			username: {
				type: 'string'
			},
			password: {
				default: null,
				type: 'string'
			},
			key: {
				default: null,
				type: 'string'
			},
			passphrase: {
				default: null,
				type: 'string'
			},
			pty: {
				default: false,
				type: 'boolean'
			},
			script: {
				type: 'string'
			}
		})


		this._exec({
			host: params.host,
			username: params.username,
			password: params.password,
			key : params.key ,
			passphrase: params.passphrase,
			script: params.script,
			port: params.port,
			pty: params.pty
		})
		.then( (result: any) => {
			this.logger.info('Succès exec ssh sur ' + req.body.host + ' (username=' + req.body.username + ')');
			res.status(200).json(result);
		})
		.catch(err => {
			next(err)
		})

	}

	/*
	* POST /ssh/checkLogin
	*/
	public checkLogin(req: express.Request, res: express.Response, next: express.NextFunction) {

		let params = HttpTools.getBodyParams(req, {
			host: {
				type: 'string'
			},
			port: {
				default: this.defaultPort,
				type: 'integer'
			},
			username: {
				type: 'string'
			},
			password: {
				default: null,
				type: 'string'
			},
			key: {
				default: null,
				type: 'string'
			},
			passphrase: {
				default: null,
				type: 'string'
			}
		})

		this.getConnection(params, {closeConnection: true})
		.then( () => {
			this.logger.info('checkLogin ' + params.username + '@' + params.host + ': OK');
			res.status(200).json({result: true});
		})
		.catch(  (error) => {

			if (error.level === 'client-authentication') {
				error.result = false;
				res.status(200).json(error);
			} else {
				next( new Errors.HttpError( error.toString() ) )
			}
		})

	}

	public checkLogins(req: express.Request, res: express.Response, next: express.NextFunction) {

		let params = HttpTools.getBodyParams(req, {
			host: {
				type: 'string'
			},
			port: {
				default: this.defaultPort,
				type: 'integer'
			},
			username: {
				type: 'string'
			},
			authList: {
				type: 'array'
			}
		})

		let promises = [];


		for ( let i = 0; i < params.authList.length; i++) {
			let auth = params.authList[i]
			let opt = {
				host: params.host,
				port: params.port,
				username: params.username,
				password: auth.password,
				passphrase: auth.passphrase,
				key: auth.key
			}

			promises.push( this.checkConnection(opt) )
		}

		Promise
		.all( promises )
		.then( (result: any) => {
			let response: any = {
				host: params.host,
				port: params.port,
				username: params.username,
				OKindex: null,
				OKcount: 0,
				results: []
			}
			for (let i = 0; i < result.length; i++) {
				let item = result[i];

				let responseItem: any = {
					result: item.result,
					error: null,
					password: req.body.authList[i].password || null,
					key: req.body.authList[i].key || null,
					passphrase: req.body.authList[i].passphrase || null,
					mode: item.mode
				}

				if (item.result) {
					response.OKcount ++
					if (response.OKindex === null) {
						response.OKindex = i;
					}
				} else {
					responseItem.error = item.error
				}

				response.results.push( responseItem );

			}

			res.status(200).json(response);
		})
		.catch( (err) => {
			next(err)
		})
	}


	/*
	* POST /ssh/execMulti
	*/
	public execMulti( req: express.Request, res: express.Response, next: express.NextFunction ) {

		let params = HttpTools.getBodyParams(req, {
			script: {
				type: 'string'
			},
			destinations: {
				type: 'array'
			}
		})


		this._execMulti( params.destinations, params.script)
		.then( (result) => {
			res.status(200).json(result);
		})
		.catch( (err) => {
			next(err)
		})
	}

	public _execMulti( destinations: any[], script: string ) {
		/*
			hosts: [
				{host, port, username, password},
				{host, port, username, password},
				...
			],
			script
		}
		*/
		return new Promise((resolve, reject) => {

			let promises = [];
			for (let i = 0; i < destinations.length; i++) {
				let dest = destinations[i];

				let opt = {
					host: dest.host,
					port: dest.port,
					username: dest.username,
					password: dest.password,
					script: script
				};

				if (typeof dest.script !== 'undefined') {
					opt.script = dest.script;
				}
				promises.push( this._exec( opt ) );
			}

			Promise.all(promises)
			.then((result: any[]) => {
				resolve(result);
			})
			.catch( error => {
				reject(error);
			})
		})
	}

	public checkConnection(params: any): Promise<{result: boolean, params: any, error: null }> {
		return this.getConnection(params, {closeConnection: true})
		.then( (sshConnection: SshConnection ) => {
			return {result: true, params: params, error: null }
		})
		.catch( (err: any ) => {
			if (err.level === 'client-authentication') {
				return {result: false, params: params, error: err }
			} else {
				throw err
			}
		})
	}

	public getConnection(params: any, options: any = null): Promise<SshConnection> {
		try {
			let opt = {
				closeConnection: false
			}
			if (options) {
				Object.keys(options).forEach( (k: string) => {
					opt[k] = options[k]
				})
			}

			let c = new SshConnection({
				logger: this.logger,
				sshKeysDir: this.sshKeysDir,
				defaultPort: this.defaultPort,
				connectTimeout: this.connectTimeout
			})

			return c.connect(params)
			.then( (conn: Ssh2.Client) => {
				if (opt.closeConnection) {
					c.close()
				}
				return c
			})

		} catch (err) {
			return Promise.reject(err)
		}
	}

	protected _exec( opt: any , sshConnection: SshConnection = null ): Promise<any> {

		let connPromise: Promise<any>

		if (sshConnection === null) {

			let defaultOpt: any = {
				pty: false,
				script: null,
				host: null,
				port: null,
				username: null,
				password: null,
				key: null,
				passphrase: null
			}
			Object.keys(defaultOpt).forEach( key => {
				if (typeof opt[key] === 'undefined') {
					opt[key] = defaultOpt[key]
				}
			})
			connPromise = this.getConnection({
				host: opt.host,
				port: opt.port,
				username: opt.username,
				password: opt.password,
				key: opt.key,
				passphrase: opt.passphrase
			})
		} else {
			connPromise = Promise.resolve(sshConnection)
		}



		let r: any = {
			host: opt.host,
			stdout: '',
			stderr: '',
			exitCode: null,
			isKilled: false
		};


		let promiseFinished = false;

		return connPromise
		.then( (connection: SshConnection) => {

			return new Promise((resolve, reject) => {

				let conn = connection.conn;

				conn.on('end', () => {

					if (!promiseFinished) {
						if (r.exitCode === null) {
							let err: SshError
							if (r.isKilled) {
								err = new SshError( 'Process killed' )
							} else {
								err = new SshError( 'SSH connection closed' )
							}
							err.connected = true
							reject( err )
						} else {
							resolve(r);
						}
					}
					promiseFinished = true;

				});

				function onExec(err: any, stream: any) {
					if (err) {
						this.logger.error(err)
						promiseFinished = true;
						let sshError: SshError = new SshError( err.toString() )
						sshError.connected = true;
						reject( sshError )
					} else {

						stream.on('exit', (code: number, signal: string) => {

							if (signal === 'SIGTERM') {
								r.isKilled = true;
							}

							if (code !== null) {
								r.exitCode = code;
							}

						});

						stream.on('close', (exitCode: number) => {
							if (exitCode !== null) {
								r.exitCode = exitCode;
							}
							conn.end();
						});

						stream.on('data', (data: any) => {
							r.stdout += data;
						});

						stream.stderr.on('data', (data: any) => {

							this.logger.debug('ONDATA');
							r.stderr += data;
						});
					}
				}

				if (opt.pty) {
					conn.exec(opt.script, {pty: true}, onExec.bind(this));
				} else {
					conn.exec(opt.script, onExec.bind(this));
				}


			})

		})

	}

	protected removeTempFileSync( path: string ) {
		try {
			fs.unlinkSync(path)
		} catch (err) {
			this.logger.warn('Failed to remove temp file ' + path + ': ' + err.toString())
		}
	}

	protected removeTempDir(dir: string) {
		setTimeout( () => {
			try {
				if (fs.pathExistsSync(dir)) {
					fs.removeSync(dir);
				}
			} catch (err) {
				this.logger.warn({err: err}, 'Error removing temp directory' + err);
			}
		}, 30000)
	}

	protected scpSend(host: string, username: string, password: string, key: string, passphrase: string, localPath: string, remotePath: string, port: number) {

		return this.getConnection({
			host: host,
			username: username,
			password: password,
			key: key,
			passphrase: passphrase,
			port: port
		})
		.then( (result: any) => {

			return new Promise((resolve, reject) => {
				let conn = result.conn;

				conn.sftp((err: any, sftp: any) => {
					if (err) {
						let sshError = new SshError(err)
						sshError.connected = true
						reject(sshError);
					} else {
						sftp.fastPut(localPath, remotePath, (err2: any, r: any) => {
							if (err2) {
								reject(new SftpError(err2));
							} else {

								resolve({
									host: host,
									port: port,
									username: username,
									remotePath: remotePath,
									localPath: localPath
								});
							}
							conn.end();
						});
					}
				})
			})
		})
	}
	protected scpGet(host: string, username: string, password: string, key: string, passphrase: string, localPath: string, remotePath: string, port: number) {

		return this.getConnection({
			host: host,
			username: username,
			password: password,
			key: key,
			passphrase: passphrase,
			port: port
		})
		.then( (result: any) => {

			return new Promise((resolve, reject) => {
				let conn = result.conn;

				conn.sftp((err: any, sftp: any) => {
					if (err) {
						let sshError: SshError = new SshError(err)
						sshError.connected = true
						reject(sshError);
					} else {
						sftp.fastGet(remotePath, localPath, (err2: any, r: any) => {
							if (err2) {
								let sftpError: SftpError = new SftpError(err2)
								reject(sftpError);
							} else {

								resolve({
									host: host,
									port: port,
									username: username,
									remotePath: remotePath,
									localPath: localPath
								});
							}
							conn.end();
						});
					}
				})
			})
		})
	}


}



