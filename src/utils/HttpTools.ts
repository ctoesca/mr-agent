

import express = require('express')
import fs = require('fs-extra')
import p = require('path');
import {Files} from './Files';
import * as Promise from 'bluebird'
import { Application } from '../Application'
import * as utils from '.'
import urlParser = require('url')
import * as Errors from '../Errors'
import Busboy = require('busboy');
const Archiver = require('archiver');
import {Tplugin as TmetricsPlugin} from '../plugins/metrics/Tplugin'
import {WorkerApplication} from '../WorkerApplication'
const HttpsProxyAgent = require('https-proxy-agent');
const https = require('https')

export class HttpTools {

	public static getApplication(): WorkerApplication{
		return  Application.getInstance() as WorkerApplication
	}
	public static getLogger(){
		return this.getApplication().getLogger('HttpTools')
	}
	
	public static getSslCertificate(opt: any)
	{
		try{
			let params : any = utils.parseParams( opt, 
			{
				hostname: {
					type: 'string'
				},
				port:{
					type: 'integer',
					default: 443
				},
				method: {
					default: 'GET',
					type: 'string'
				},
				protocol:{
					default: "https:",
					type: 'string'
				},
				timeout:{
					default: 5000,
					type: 'integer'
				}
			})

			/*
			proxy peut être :
				- une chaine (ex: http://168.63.76.32:3128) 
				- ou un objet: 
				{
					host - String - Proxy host to connect to (may use hostname as well). Required.
					port - Number - Proxy port to connect to. Required.
					protocol - String - If https:, then use TLS to connect to the proxy.
					headers - Object - Additional HTTP headers to be sent on the HTTP CONNECT method.
					Any other options given are passed to the net.connect()/tls.connect() functions.
				}
			*/
			if (typeof opt.proxy !== 'undefined')
				params.proxy = opt.proxy

			let options: any = {
				hostname: params.hostname,
				agent: false,
				rejectUnauthorized: false,
				ciphers: 'ALL',
				port: params.port,
				protocol: params.protocol
			}

			if (params.timeout)
				options.timeout = params.timeout

			if (params.proxy){
				options.agent = new HttpsProxyAgent(params.proxy);
			}
			var promiseIsResolved = false
			
			this.getLogger().info("getSslCertificate sur "+params.hostname+':'+params.port+'...')

			return new Promise( (resolve, reject) => {
				var timeout: any

				var req: any = https.get(options, (res: any) => 
				{
					try{
						if (timeout)
							clearTimeout(timeout)

						this.getLogger().info("getSslCertificate response sur "+params.hostname+':'+params.port)

						var certificate = res.socket.getPeerCertificate();

					    if (utils.isEmpty(certificate) || certificate === null) {
					      	if (!promiseIsResolved)
						  	{
						  		reject(new Error('The website did not provide a certificate' ));
						  		promiseIsResolved = true
					      	}
					    } else 
					    {
					      	if (certificate.raw) {
					        	certificate.pemEncoded = this.pemEncode(certificate.raw.toString('base64'), 64);
					      	}
					      	if (!promiseIsResolved)
						  	{
								resolve(certificate);
					      		promiseIsResolved = true
					      	}
					    }
					}catch(err){
						
						this.getLogger().error("getSslCertificate response exception sur "+params.hostname+':'+params.port)

						if (!promiseIsResolved)
						{
							reject(err)
							promiseIsResolved = true
						}
					}
				    
			  	});

				req.on('timeout', (err: any) => {			
					
					this.getLogger().info("getSslCertificate timeout1 sur "+params.hostname+':'+params.port)
					req.destroy('Request timed out')
				});
				
				req.on('error', (err: any) => {

					this.getLogger().info("getSslCertificate error sur "+params.hostname+':'+params.port, err)
					if (timeout)
						clearTimeout(timeout)

					if (!promiseIsResolved)
					{
						reject(err);
						promiseIsResolved = true
					}
				});

				req.end();
			})

		}catch(err){
			this.getLogger().error("getSslCertificate exception ", err)
			return Promise.reject(err)
		}

	}


	protected static pemEncode(str: string, n: number) {
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

	public static saveUploadedFile(req: express.Request, res: express.Response, next: express.NextFunction, opt: any = {}): Promise<any> {

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

		})

		

		return new Promise((resolve, reject)  => {

			let result: any = {
				files: [],
				fields: []
			}
			let promiseResolved = false;
			let hasFile = false

			try {

				let busboy = new Busboy({ headers: req.headers });

				busboy.on('field', (fieldname: string, val: any, fieldnameTruncated: boolean, valTruncated: boolean, encoding: string, mimetype: string) => {
					
					this.getLogger().debug("upload field: "+fieldname+'='+val)

					result.fields[fieldname] = {
						val: val,
						fieldnameTruncated: fieldnameTruncated,
						valTruncated: valTruncated,
						encoding: encoding,
						mimetype: mimetype
					}
				});

				busboy.on('finish', () => {

					if (!hasFile && !promiseResolved) {
						reject(new Errors.HttpError('No file uploaded', 400));
					}

				});

				busboy.on('file', (fieldName: string, file: NodeJS.ReadableStream, filename: string, encoding: string, mimetype: string) => {
					
					if (hasFile)
					{
						if (!promiseResolved) {
							promiseResolved = true;
							reject(new Errors.BadRequest("Only one file can be uploaded"))
						}
						file.resume()
						return
					}

					hasFile = true

					let checkPromise: Promise<any>
					if (opt.onBeforeSaveFile){
						checkPromise = opt.onBeforeSaveFile(result.fields, opt, filename, encoding, mimetype, file)
					} else {
						checkPromise = Promise.resolve(opt)
					}
					
					checkPromise.then( (r) => {
						

						/* checkPromise peut renvoyer les options modifiées */
						if (r)
							opt = r

						/* verification de base */
						let pathIsTmp = false

						if (opt.path === null){
							pathIsTmp = true
							opt.path = p.normalize( Application.getInstance().getTmpDir() + '/uploads/'+ Math.round( Math.random() * 100000000000 ) )+ '.' + filename
						}
						
						let uploadDir = p.normalize( p.dirname(opt.path) )

						if ( !fs.pathExistsSync(uploadDir) ) {
							if (pathIsTmp || opt.createDir) {
								fs.ensureDirSync(uploadDir)
							} else {
								throw new Errors.BadRequest('Upload directory does not exist: ' + uploadDir)
							}
						}
						
						if (fs.pathExistsSync(opt.path) ) 
						{
							if (Files.getFileStat(opt.path).isDir) {
								throw new Errors.BadRequest('Upload destination is a directory: ' + opt.path)
							}
							if (!opt.overwrite && !opt.start)
								throw new Errors.BadRequest('File already exists: ' + opt.path);
						}

						return this.checkUploadSize(opt.path, req, opt.maxUploadSize)
					})
					.then(()=>
					{

						if (!promiseResolved) 
						{
							let f: any = {
								name: filename,
								fieldName: fieldName,
								encoding: encoding,
								mimeType: mimetype,
								path: opt.path
							}

							result.files.push( f )

							let createStreamOpt : any = {}

							if (opt.start !== null){
								
								/*if (fs.existsSync(opt.path))
								{									
									createStreamOpt.start = fs.statSync(opt.path).size
								}*/

								createStreamOpt = {
									flags: 'r+',
									mode: 777,
									start: opt.start
								}
							}
						

							let fstream = fs.createWriteStream(opt.path, createStreamOpt)
							file.pipe( fstream )

							fstream.on('error', (err) => {
								promiseResolved = true
								reject(err)
							})

							fstream.on('finish', () => {
								if (!promiseResolved) {
									promiseResolved = true
									resolve(result)
								}
							})

						} else {
							file.resume()
						}

					})
					.catch(err => {

						file.resume()

						if (!promiseResolved) {
							promiseResolved = true;
							reject(err)
						}

					})
				});

				req.pipe(busboy);

			} catch (err) {
				if (!promiseResolved) {
					promiseResolved = true;
					reject(err)
				}
			}

		})
	}

	public static checkUploadSize(destFilePath: string, req: express.Request, max: number = null): Promise<any> {
		// !! verifier l'espace sur le disque ou se trouve l'agent, dans la fonction saveUploadedFiles
		// Faire fonction qui verifie l'espace

		let app = this.getApplication()

		if (utils.isWin() && req.headers['content-length']) {

			let contentLength: number = parseInt( req.headers['content-length'], 10)
			
			if ((max !== null) && (contentLength >= max)) 
				return Promise.reject( new Errors.BadRequest('Taille max upload: ' + max / 1024 / 1024 + ' Mo') )

			if (contentLength > 1024*1024*20){
				/* cette fonction utilise wmic qui crée une latence de 2 sec environ . on ne vérifie pas l'espace libre en dessous de 20Mo */
				/* verif espace disque */
				let metrics: TmetricsPlugin = app.getPluginInstance('metrics') as TmetricsPlugin
				if (metrics) {
					
					return metrics.getMetric('disks')
					.get()
					.then((result: any) => {
						

						let diskName: string = destFilePath.leftOf(':').toUpperCase()

						if (typeof result[diskName + ':'] !== 'undefined') {
							let diskInfos: any = result[diskName + ':']
							let maxFileSize: number = (diskInfos.free - (5 * diskInfos.total / 100) )
							if (contentLength >= maxFileSize) {
								throw new Errors.BadRequest('Espace insuffisant sur le disque '+diskName);
							}
						}
						return true
					})
				} else {
					this.getLogger().error("Aucune instance de 'checker' n'est instanciée")
					return Promise.resolve()
				}
			} else {
				return Promise.resolve()
			}
		} else {
			return Promise.resolve()
		}

	}

	public static sendZipFile(res: express.Response, next: express.NextFunction, path: string, zipFileName: string): Promise<any> {

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
		})

		return Files.isDir(opt.path)
		.then( (isDir) => {

			return new Promise((resolve, reject)  => {

				try {

					let zip = Archiver('zip');

					zip.on('end', () => {

						if (!res.headersSent) {
							res.set('Content-Type', 'application/zip');
							res.status(200);
							res.send('OK').end();
						}

						resolve({message: 'Envoi zip ok'});

					});

					zip.on('error', (err: any) => {
						reject( err );
					});

					zip.on('finish', function() {
						resolve({message: 'Envoi zip ok'});
					})

					zip.pipe(res);

					if (isDir) {
						zip.directory(opt.path, '', (data: any) => {
							return data;
						});
					} else {
						let files = [opt.path];
						for (let f of files) {
							zip.append(fs.createReadStream(f), { name: p.basename(f) });

						}
					}
					res.attachment(opt.zipFileName)
					zip.finalize();

				} catch (err) {

					reject( err );
				}
			})
		})
	}

	public static getBodyParams(req: express.Request, fields: any) {
		if (typeof req.body === 'undefined') {
			throw new Errors.BadRequest('body undefined')
		}
		let params = req.body
		return utils.parseParams(params, fields, true)
	}

	public static getQueryParams(req: express.Request, fields: any) {
		let u = urlParser.parse(req.url, true);
		let params = u.query
		return utils.parseParams(params, fields, false)
	}

}
