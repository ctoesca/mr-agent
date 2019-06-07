

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

export class HttpTools {

	public static saveUploadedFile(req: express.Request, res: express.Response, next: express.NextFunction, opt: any = {}): Promise<any> {

		opt = utils.parseParams(opt, {
			uploadDir: {
				default: p.normalize( Application.getInstance().getTmpDir() + '/uploads' ),
				type: 'string'
			},
			preserveFilename: {
				default: false,
				type: 'boolean'
			},
			createDir: {
				default: true,
				type: 'boolean'
			},
			overwrite: {
				default: true,
				type: 'boolean'
			}
		})

		return new Promise((resolve, reject)  => {

			let result: any = {
				files: [],
				fields: []
			}
			let promiseResolved = false;

			try {

				if ( !fs.pathExistsSync(opt.uploadDir) ) {
					if (opt.createDir) {
						fs.ensureDirSync(opt.uploadDir)
					} else {
						throw new Errors.HttpError('Upload directory does not exist: ' + opt.uploadDir, 400)
					}
				} else {
					if (!Files.getFileStat(opt.uploadDir).isDir) {
						throw new Errors.HttpError('Upload destination is not directory: ' + opt.uploadDir, 400)
					}
				}

				let busboy = new Busboy({ headers: req.headers });

				busboy.on('field', (fieldname: string, val: any, fieldnameTruncated: boolean, valTruncated: boolean, encoding: string, mimetype: string) => {

					result.fields[fieldname] = {
						val: val,
						fieldnameTruncated: fieldnameTruncated,
						valTruncated: valTruncated,
						encoding: encoding,
						mimetype: mimetype
					}
				});

				/*busboy.on('finish', () => {
				});*/

				busboy.on('file', (fieldName: string, file: NodeJS.ReadableStream, filename: string, encoding: string, mimetype: string) => {
					try {

						if (!promiseResolved) {
							
							let filePath
							if (opt.preserveFilename) {
								filePath = p.normalize(opt.uploadDir + '/' + filename)
							} else {
								filePath = p.normalize( opt.uploadDir + '/' + Math.round( Math.random() * 100000000000 ) + '.' + filename )
							}

							if (fs.pathExistsSync(filePath)) {
								if (!Files.getFileStat(filePath).isFile) {
									throw new Errors.HttpError('Upload destination is directory: ' + filePath, 400);
								}
							}

							let f: any = {
								name: filename,
								fieldName: fieldName,
								encoding: encoding,
								mimeType: mimetype,
								path: filePath
							}

							if (!opt.overwrite && fs.pathExistsSync(filePath) ) {
								if (!promiseResolved){
									promiseResolved = true;
									reject( new Error('File already exists: ' + filePath));
								}
							} else {
								result.files.push( f )
								let fstream = fs.createWriteStream(filePath)
								file.pipe( fstream )
								fstream.on('close', () => {
									if (!promiseResolved) {
										promiseResolved = true
										resolve(result)
									}
								})
							}

						}


					} catch (err) {
						if (!promiseResolved){
							promiseResolved = true;
							reject(err)
						}
					}
				});

				req.pipe(busboy);

			} catch (err) {
				if (!promiseResolved){
					promiseResolved = true;
					reject(err)
				}
			}

		})
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
			throw new Errors.BadRequest('body is not JSON')
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
