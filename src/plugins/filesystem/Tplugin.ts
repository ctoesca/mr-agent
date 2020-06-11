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

import {WorkerApplication as Application}  from '../../WorkerApplication'
import Promise = require('bluebird')
import bodyParser = require('body-parser');
import rimraf = require("rimraf");
const streamZip = require('node-stream-zip');

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
			this.config.maxUploadSize = 300 * 1024 * 1024 * 1024
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
		this.app.post('/uncompressFile', this.uncompressFile.bind(this));
		this.app.post('/createDir', this.createDir.bind(this));
		
		this.app.post('/mergeFileParts', this.mergeFileParts.bind(this));
		this.app.post('/uploadPart', this.uploadPart.bind(this));	


		this.app.get('/downloadFilePart', this.downloadFilePart.bind(this));
	}

	public downloadFilePart(req: express.Request, res: express.Response, next: express.NextFunction){
		let params : any = HttpTools.getQueryParams(req, 
			{
				path: {
					type: 'string'
				},
				part:{
					type: 'integer'
				},
				blocsize: {
					default: 1024*1024*1024,
					type: 'integer'
				}
			}
		)

		if (!fs.existsSync(params.path)) {
			this.logger.warn('downloadFilePart path=' + params.path + ': fichier inexistant');
			throw new Errors.NotFound('Le fichier ' + params.path + ' n\'existe pas');
		}

		res.set('x-part', params.part)
		res.set('x-blocsize', params.blocsize)
			
		Files.getFilePart(params.path, params.part, params.blocsize)
		.then( (result: any) => {
			let readStream: fs.ReadStream = result.stream

			//console.log(result)
			res.set('x-total-size', result.totalSize)
			res.set('x-start-position', result.start)
			res.set('x-end-position', result.end)

			res.attachment( p.basename(params.path)+'-part'+params.part)
			readStream.pipe( res )
		})
		.catch( (err) => {
			next(err)
		})

	}
	public getUploadPartDirectory(uid: string, createIfNotExists = false){
		let r = this.application.getTmpDir() + '/uploads/parts-'+uid
		
		if (createIfNotExists)
		{			
			if (!fs.existsSync(r))
				fs.mkdirpSync(r)
		}

		return r
	}
	public uploadPart(req: express.Request, res: express.Response, next: express.NextFunction) {

		let params = HttpTools.getQueryParams(req, {
			uid: {
				type: 'string'
			}
		})

		this.logger.info('Upload part ' + params.uid+' ...')

		let uploadedFile: any = null
		let uploadDir = this.getUploadPartDirectory( params.uid, true )

		//throw new Errors.HttpError("uid "+params.uid+" already exists", 400)
		
		let opt = {
			maxUploadSize: this.config.maxUploadSize,
			uploadDir: uploadDir,
			preserveFilename: true
		}

		return HttpTools.saveUploadedFile(req, res, next, opt)
		.then( (result: any) => {

			if (result.files.length === 0) {
				throw new Errors.BadRequest('No file uploaded')
			} else {
				uploadedFile = result.files[0]

			}
		})

		.then( () => {

			this.logger.info('Upload part ' +params.uid+' saved :' + uploadedFile.path)

			let r: any = {
				uploadedFile: uploadedFile
			}
			res.status(200).json(r);
		})
		.catch( (err: any) => {
			next(err);
		})
	}
	
	public mergeFileParts(req: express.Request, res: express.Response, next: express.NextFunction) {

		let params = HttpTools.getBodyParams(req, {
			files: {
				type: 'string'
			},
			destFilepath: {
				type: 'string'
			}
		})

		this.logger.info("mergeUploadedParts "+params.destFilepath+" ...")

		return Files.mergeFiles(params.files, params.destFilepath)
		.then((result: any) => {

			this.logger.info("Success mergeUploadedParts "+params.uid+", destFilepath: " +params.destFilepath)

			res.json(result)
		})
		.catch( (err: any) => {
			next(err)
		})
	}

	/*public mergeUploadedParts(req: express.Request, res: express.Response, next: express.NextFunction) {


		let params = HttpTools.getBodyParams(req, {
			uid: {
				type: 'string'
			},
			destFilepath: {
				type: 'string'
			}
		})

		let dir: string = this.getUploadPartDirectory(params.uid)
		let destFilepath = params.destFilepath

		this.logger.info("mergeUploadedParts "+params.uid+", destFilepath: "+params.destFilepath+" ...")

		this.tools.findFiles(dir, '*', false)
		.then((result: any) => {

			let paths = []
			for (let file of result.files) {
				if (file.isFile)
					paths.push(file.path)
			}
			return Files.mergeFiles(paths, destFilepath)
		})
		
		.then((result: any) => {

			this.logger.info("Success mergeUploadedParts "+params.uid+", destFilepath: " +params.destFilepath)

			res.json(result)
		})
		.catch( (err: any) => {
			next(err)
		})
	}*/

	public upload(req: express.Request, res: express.Response, next: express.NextFunction) {
		
		let params : any = {}

		var onBeforeSaveFile = (fields: any, opt: any, filename: string) => {

			try{
		
				for(let k in fields){
					params[k] = fields[k].val
				}

				params = utils.parseParams(params, {
					path: {
						type: 'string'
					},
					overwrite: {
						default: true,
						type: 'boolean'
					},
					directUpload:{
						default: false,
						type: 'boolean'
					},
					
					start:{
						default: null,
						type: 'integer'
					}
				})

				if (params.start !== null){
					params.overwrite = true
					params.directUpload = true
				}

				this.logger.info('Upload path=' + params.path + ' filename='+filename+', start='+params.start+', overwrite=' + params.overwrite+' ...')
				
				let uploadDir = p.normalize( p.dirname(params.path) )

				if (!fs.pathExistsSync(uploadDir)) {
					throw new Errors.BadRequest(uploadDir + ' upload directory does not exist')
				}



				if (fs.pathExistsSync(params.path)) {
					if (!Files.getFileStat(params.path).isFile) {
						throw new Errors.BadRequest('Upload destination is directory: ' + params.path);
					}
					if (!params.overwrite) {
						throw new Errors.BadRequest('File already exist: ' + params.path + ' (use overwrite option)');
					}
				}
				
				let checkSizePromise 
				
				if (params.directUpload)
				{
					/* HttpTools enregistre le fichier directement sur la destination finale (pas dans tmp)*/
					opt.path = params.path
					checkSizePromise = Promise.resolve()
				} else 
				{
					/* 
					HttpTools enregistre le fichier dabs le rep temporaire et verifie l'espace disque restant sur ce disuqe, mais pas sur la destination finale.
					*/
					checkSizePromise =  HttpTools.checkUploadSize(params.path, req, this.config.maxUploadSize)
				}
				
				opt.start = params.start

				return checkSizePromise
				.then(()=>
				{
					return opt
				})

			}catch(err){

				return Promise.reject(err)
			}
		}

		let uploadedFile: any = null

		return HttpTools.saveUploadedFile(req, res, next, {
			maxUploadSize: this.config.maxUploadSize,
			onBeforeSaveFile: onBeforeSaveFile,
			
		})
		
		.then( (result: any) => {
			if (result.files.length === 0) {
				throw new Errors.BadRequest('No file uploaded')
			} else {
				uploadedFile = result.files[0]
				if (!params.directUpload)
					return fs.move(uploadedFile.path, params.path, {overwrite: params.overwrite})
			}
		})

		.then( () => {

			this.logger.info('Succes upload ' + params.path + ', start='+params.start+', overwrite=' + params.overwrite)

			let r: any = {
				path: params.path,
				file: Files.getFileStat(params.path, true)
			}
			res.status(200).json(r);
		})
		.finally( () => {
			if (uploadedFile && !params.directUpload && (params.start===null)) 
			{
				if (fs.existsSync(uploadedFile.path))
					fs.removeSync(uploadedFile.path)
			}
		})
		.catch( (err: any) => {this.logger.error(err)
			next(err);
		})
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
			throw new Errors.BadRequest("Valeur incorrect pour la propriété 'type'. Valeurs possible: 'shell'|'javascript'", 412);
		}
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
			this.logger.info('download path=' + params.path+' ...');
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

			let stat = Files.getFileStat(params.path, true);
			if (stat.isDir) {
				rimraf(params.path, (err) => {
					if (err)
						next(err)
					else
						res.status(200).json( { filename: filename, path: params.path} );
				})
			} else 
			{
				fs.unlink(params.path).then( () => {
					res.status(200).json( { filename: filename, path: params.path} );
				})
				.catch( (err: any) => {
					next(err)
				})
			}
		}

	}


	public createDir(req: express.Request, res: express.Response, next: express.NextFunction) {
		let params : any = HttpTools.getBodyParams(req, {
			parentDir: {
				type: 'string'
			},
			name: {
				type: 'string',
				default: null
			}
		})

		this.logger.info('createDir parentDir=' + params.parentDir);

		let fullPath: string

		if (!params.name) {
			params.name = "nouveau_dossier"
			let index = 0;
			
			while (fs.existsSync(params.parentDir+"/"+params.name)) {
				index ++
				params.name = "nouveau_dossier_"+index
			}

		} 
		
		fullPath = p.normalize(params.parentDir+"/"+params.name)
		
		fs.pathExists(fullPath)
		.then( pathExits => {
			if (pathExits) {
				throw new Errors.BadRequest(fullPath + ' already exists')
			}
			return fs.ensureDir(fullPath)
		})
		.then( () => {

			let r: any =  {
				path: fullPath,
				name: params.name
			}

			r.fileinfo = Files.getFileStat(fullPath, true);
			res.status(200).json( r );
		})
		.catch(err => {
			next(err)
		})

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
				throw new Errors.BadRequest(params.path + ' does not exist')
			}
			return fs.pathExists(params.dest)

		})
		.then( destExists => {

			if (destExists && !params.overwrite) {
				throw new Errors.BadRequest('Destination ' + params.dest + ' already exists')
			}

			let dir: string = p.normalize(p.dirname(params.dest))
			if (!fs.pathExistsSync(dir)) {
				throw new Errors.BadRequest('Destination directory ' + dir + ' does not exist')
			}

			return fs.move(params.path, params.dest, {overwrite: params.overwrite})

		})
		.then( () => {
			res.status(200).json( { path: params.path, dest: params.dest} );
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
				throw new Errors.BadRequest(params.path + ' does not exist')
			}

			let sourceStat = Files.getFileStat(params.path, false);
			if (!sourceStat.isFile) {
				throw new Errors.BadRequest(params.path + ' is not a file')
			}

			return fs.pathExists(params.dest)

		})
		.then( destExists => {
			if (destExists) {
				let destStat = Files.getFileStat(params.dest, false);
				if (!destStat.isFile) {
					throw new Errors.BadRequest('Destination ' + params.dest + ' is not a file')
				}
			}

			let dir: string = p.normalize(p.dirname(params.dest))
			if (!fs.pathExistsSync(dir)) {
				throw new Errors.BadRequest('Destination directory ' + dir + ' does not exist')
			}

			return fs.copy(params.path, params.dest, {errorOnExist : true, overwrite: true})
		})
		.then( () => {
			res.status(200).json( { path: params.path, dest: params.dest} );
		})
		.catch(err => {
			next(err)
		})

	}

	public uncompressFile(req: express.Request, res: express.Response, next: express.NextFunction) {

		let params = HttpTools.getBodyParams(req, {
			path: {
				type: 'string'
			},
			destDir: {
				type: 'string',
				default: null
			}
		})

		let destDir:string = params.destDir
		if (!destDir)
			destDir = p.dirname(params.path)
		
		destDir = p.normalize(destDir)

		this.logger.info('uncompressFile path=' + params.path + ', destDir=' + destDir);

		fs.pathExists(params.path)
		.then( pathExits => {
			if (!pathExits) {
				throw new Errors.BadRequest(params.path + ' does not exist')
			}

			let sourceStat = Files.getFileStat(params.path, false);
			if (!sourceStat.isFile) {
				throw new Errors.BadRequest(params.path + ' is not a file')
			}
			if (!sourceStat.name.endsWith('.zip'))
				throw new Errors.BadRequest(params.path + ' is not a zip file')

			return fs.pathExists(destDir)
			
		})
		.then( destExists => {
			if (destExists) {
				let destStat = Files.getFileStat(destDir, false);
				if (!destStat.isDir) {
					throw new Errors.BadRequest('Destination ' + destDir + ' is not a directory')
				}
			} else {
				throw new Errors.BadRequest("Destination directory '"+destDir+"' does not exist")
			}
			
			let zip = new streamZip( {
				file: params.path
			})
			zip.on('ready', () => {

				zip.extract(null, destDir, (err: any) => {
					if (err){
						this.logger.error("uncompressFile "+params.path, err)
						next(err)
					} else {

						let r: any = { 
							path: params.path, 
							destDir: destDir
						}
						
						res.status(200).json( r );
					}

					zip.close();
				});
			});
			zip.on('error', (err: any)  => {
				this.logger.error("uncompressFile "+params.path, err)
				next(err)
			});
		
		})
		
		.catch(err => {
			this.logger.error("uncompressFile "+params.path, err)
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
				throw new Errors.BadRequest(params.path + ' does not exist')
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


