import {Tools} from './Tools'
import {ThttpPlugin} from '../ThttpPlugin'
import {Files} from '../../utils/Files'
import {HttpTools} from '../../utils/HttpTools'
import {TwinTools} from './TwinTools'
import {TlinuxTools} from './TlinuxTools'
import fs = require('fs-extra')
import p = require('path')
import vm = require('vm')
import express = require('express')
import * as utils from '../../utils'
import '../../utils/StringTools'
import * as Errors from '../../Errors'
import {Tplugin as TmetricsPlugin} from '../../plugins/metrics/Tplugin'
import {WorkerApplication as Application}  from '../../WorkerApplication'
import Promise = require('bluebird')
import bodyParser = require('body-parser');

export class Tplugin extends ThttpPlugin {

	protected tools: Tools = null

	constructor(application: Application, config: any) {

		super(application, config);

		if (utils.isWin()) {
			this.tools = new TwinTools( {tmpDir: this.tmpDir , module: this} );
		} else {
			this.tools = new TlinuxTools( {tmpDir: this.tmpDir , module: this} );
		}

		if (!this.config.maxUploadSize) {
			this.config.maxUploadSize = 500 * 1024 * 1024
		}
	}

	public install() {
		super.install();

		this.app.use( bodyParser.json({
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

	}

	public writeTextFile(req: express.Request, res: express.Response, next: express.NextFunction) {

		let params = HttpTools.getBodyParams(req, {
			content: {
				type: 'string'
			},
			path: {
				type: 'string'
			}
		})

		fs.writeFile(params.path, params.content)
		.then(() => {
			let r: any = {
				result: true,
				path: params.path,
				fileinfo: null
			}
			r.fileinfo = Files.getFileStat(params.path, true);
			res.status(200).json( r );
		})
		.catch(err => {
			this.logger.error('ERROR writeTextFile path=' + params.path + '" : ' + err.toString());
			next(err)
		})

	}

	public execScript(req: express.Request, res: express.Response, next: express.NextFunction) {

		let params = HttpTools.getBodyParams(req, {
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
		})

		this.logger.info('filesystem/execScript type=' + params.type);

		if (params.type === 'shell') {

			this.tools.execScript(params.script, params.args).then(
				function(result: any) {
					res.status(200).json(result);
				},
				function(error: any) {
					res.status(500).json(error);
				}
				);
		} else if (params.type === 'javascript') {
			/*
			Commande de test:
			curl -i -H "Content-Type: application/json" -X POST "http://localhost:3000/filesystem/execScript" -d "{""type"":""javascript"",""script"":""result=3""}"
			*/
			const sandbox: any = {
				fs: require('fs'),
				$this: this,
				result: null,
				exitCode: 0
			};

			vm.runInNewContext(params.script, sandbox);
			res.status(200).json({exitCode: sandbox.exitCode, stdout: sandbox.result, stderr: ''});


		} else {
			throw new Errors.HttpError("Valeur incorrect pour la propriété 'type'. Valeurs possible: 'shell'|'javascript'", 412);
		}
	}

	public checkUploadSize(destFilePath: string, req: express.Request): Promise<any> {
		// !! verifier l'espace sur le disque ou se trouve l'agent, dans la fonction saveUploadedFiles
		// Faire fonction qui verifie l'espace
		if (utils.isWin() && req.headers['content-length']) {

			let fileSize: number = parseInt( req.headers['content-length'], 10)
			let metrics: TmetricsPlugin = this.application.getPluginInstance('metrics') as TmetricsPlugin

			if (metrics) {
				return metrics.getMetric('disks')
				.get()
				.then((result: any) => {
					let diskName: string = destFilePath.leftOf(':').toUpperCase()

					if (typeof result[diskName + ':'] !== 'undefined') {
						let diskInfos: any = result[diskName + ':']
						let maxFileSize: number = (diskInfos.free - (5 * diskInfos.total / 100) )

						if (fileSize >= this.config.maxUploadSize) {
							throw new Error('Taille max upload: ' + this.config.maxUploadSize / 1024 / 1024 + ' Mo');
						} else if (fileSize >= maxFileSize) {
							throw new Error('Espace insuffisant');
						}
					}
					return true
				})
			} else {
				this.logger.error("Aucune instance de 'checker' n'est instanciée")
				return Promise.resolve()
			}
		} else {
			return Promise.resolve()
		}

	}

	public upload(req: express.Request, res: express.Response, next: express.NextFunction) {

		let params = HttpTools.getQueryParams(req, {
			path: {
				type: 'string'
			},
			overwrite: {
				default: true,
				type: 'boolean'
			}
		})

		this.logger.info('Upload ' + params.path + ', overwrite = ' + params.overwrite)

		let uploadDir = p.normalize( p.dirname(params.path) )
		if (!fs.pathExistsSync(uploadDir)) {
			throw new Errors.HttpError(uploadDir + ' directory does not exist', 400)
		}

		if (fs.pathExistsSync(params.path)) {
			if (!params.overwrite) {
				throw new Errors.HttpError('File already exist: ' + params.path + ' (use overwrite option)', 400);
			}
			if (!Files.getFileStat(params.path).isFile) {
				throw new Errors.HttpError('Upload destination is directory: ' + params.path, 400);
			}
		}

		this.checkUploadSize(params.path, req)
		.then( () => {
			return HttpTools.saveUploadedFile(req, res, next)
		})
		.then( (result: any) => {

			if (result.files.length === 0) {
				throw new Errors.HttpError('No file uploaded', 400)
			} else {
				return fs.move(result.files[0].path, params.path, {overwrite: params.overwrite})				
			}
		})

		.then( result => {

			this.logger.info('Succes upload ' + params.path + ', overwrite = ' + params.overwrite)

			let r: any = {
				result: true,
				path: params.path,
				file: Files.getFileStat(params.path, true)
			}
			res.status(200).json(r);
		})

		.catch( (err: any) => {
			this.logger.error(err.toString())
			next(err);
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
			}
		})

		if (utils.isWin()) {
			params.path = params.path.replace(/\//g, '\\');
		}

		if (!fs.existsSync(params.path)) {
			this.logger.warn('download path=' + params.path + ': fichier inexistant');
			throw new Errors.NotFound('Le fichier ' + params.path + ' n\'existe pas');
		} else {
			let stat = Files.getFileStat(params.path, false);
			if (stat.isDir) {
				params.compress = true;
			}
		}

		this.logger.info('download path=' + params.path + ',compress=' + params.compress);

		if (params.compress) {

			let zipFileName = Files.getFileName(params.path) + '.zip';
			HttpTools.sendZipFile(res, next, params.path, zipFileName)
			.catch( (err: any) => {
				next(err)
			})

		} else {
			res.download(params.path)
			/*let filestream = fs.createReadStream(params.path);
			filestream.pipe(res);*/
		}

		// var filestream = fs.createReadStream(path);
		// filestream.pipe(res);
	}

	public deleteFiles(req: express.Request, res: express.Response, next: express.NextFunction) {

		let params = HttpTools.getBodyParams(req, {
			path: {
				type: 'string'
			}
		})

		this.logger.info('deleteFiles path=' + params.path);
		let filename = require('path').basename(params.path)


		if (!fs.existsSync(params.path)) {
			this.logger.warn('path=' + params.path + ' => fichier inexistant');
			throw new Errors.NotFound("'" + params.path + '- does not exist')
		} else {
			fs.unlinkSync(params.path)
			res.status(200).json( {result: true, filename: filename, path: params.path} );
		}

	}

	public moveFile(req: express.Request, res: express.Response, next: express.NextFunction) {

		let params = HttpTools.getBodyParams(req, {
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
		})

		this.logger.info('moveFile path=' + params.path + ', dest=' + params.dest);

		fs.pathExists(params.path)
		.then( pathExits => {
			if (!pathExits) {
				throw new Errors.HttpError(params.path + ' does not exist', 400)
			}

			let sourceStat = Files.getFileStat(params.path, false);
			if (!sourceStat.isFile) {
				throw new Errors.HttpError('source ' + params.path + ' is not a file', 400)
			}

			return fs.pathExists(params.dest)

		})
		.then( destExists => {

			if (destExists && !params.overwrite) {
				throw new Errors.HttpError('Destination ' + params.dest + ' already exists', 400)
			}

			let dir: string = p.normalize(p.dirname(params.dest))
			if (!fs.pathExistsSync(dir))
				throw new Errors.HttpError('Destination directory' + dir + ' does not exist', 400)

			return fs.move(params.path, params.dest, {overwrite: params.overwrite})

		})
		.then( () => {
			res.status(200).json( {result: true, path: params.path, dest: params.dest} );
		})
		.catch(err => {
			next(err)
		})

	}

	public copyFile(req: express.Request, res: express.Response, next: express.NextFunction) {

		let params = HttpTools.getBodyParams(req, {
			path: {
				type: 'string'
			},
			dest: {
				type: 'string'
			}
		})

		this.logger.info('copyFile path=' + params.path + ', dest=' + params.dest);

		fs.pathExists(params.path)
		.then( pathExits => {
			if (!pathExits) {
				throw new Errors.HttpError(params.path + ' does not exist', 400)
			}

			let sourceStat = Files.getFileStat(params.path, false);
			if (!sourceStat.isFile) {
				throw new Errors.HttpError(params.path + ' is not a file', 400)
			}

			return fs.pathExists(params.dest)

		})
		.then( destExists => {
			if (destExists) {
				let destStat = Files.getFileStat(params.dest, false);
				if (!destStat.isFile) {
					throw new Errors.HttpError('Destination ' + params.dest + ' is not a file', 400)
				}
			}

			let dir: string = p.normalize(p.dirname(params.dest))
			if (!fs.pathExistsSync(dir))
				throw new Errors.HttpError('Destination directory' + dir + ' does not exist', 400)

			return fs.copy(params.path, params.dest, {errorOnExist : true, overwrite: true})
		})
		.then( () => {
			res.status(200).json( {result: true, path: params.path, dest: params.dest} );
		})
		.catch(err => {
			next(err)
		})

	}

	public fileinfo(req: express.Request, res: express.Response, next: express.NextFunction) {
		let params = HttpTools.getQueryParams(req, {
			path: {
				type: 'string'
			}
		})

		this.logger.info('fileinfo path=' + params.path);

		fs.pathExists(params.path)
		.then( exists => {
			if (!exists) {
				throw new Error(params.path + ' does not exist')
			}

			let stat = Files.getFileStat(params.path, true);
			res.status(200).json( stat );
		})
		.catch(err => {
			next(err)
		})

	}

	public fileExists(req: express.Request, res: express.Response, next: express.NextFunction) {

		let params = HttpTools.getQueryParams(req, {
			path: {
				type: 'string'
			}
		})

		fs.pathExists(params.path)
		.then( exists => {
			res.status(200).json( { result: exists}  );
		})
		.catch(err => {
			next(err)
		})

	}

	public list(req: express.Request, res: express.Response, next: express.NextFunction) {

		/* utilisation CMD car très rapide. En JS, on serait obligé de faire un fileStat sur chaque fichier trouvé (très lent en partage réseau) */

		let params = HttpTools.getQueryParams(req, {
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
		})

		this.logger.info('list path=' + params.path + ', filter=' + params.filter + ', recursive=' + params.recursive + ',maxResults=' + params.maxResults);

		this.tools.findFiles(params.path, params.filter, params.recursive, params.maxResults)
		.then((result: any) => {
			res.status(200).json(result);
		})
		.catch( err => {
			next(err)
		})

	}



}


