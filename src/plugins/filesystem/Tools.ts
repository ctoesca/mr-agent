
import {Application} from '../../Application'
import fs = require('fs-extra');
import child_process = require('child_process');
import bunyan = require('bunyan');
import klaw = require('klaw')
import minimatch = require('minimatch')
import {Files} from '../../utils/Files'
import * as utils from '../../utils'

export class Tools {

	protected tmpDir: string = null
	protected logger: bunyan = null

	constructor(opt: any) {

		this.tmpDir = opt.tmpDir;	// !! sur win 2003, le répertoire d'execution est windows\system32\
		this.logger = Application.getLogger(this.constructor.name);
	}

	public listFiles(dir: string): Promise<any> {

		return fs.readdir(dir)
		.then( (files) => {

			let r: any = {
				files: [],
				total: 0
			};

			for (let path of files) {
				path = dir + '/' + path;

				try {
					r.files.push( Files.getFileStat(path, true) );
				} catch (err) {
					this.logger.warn('getFileStat(' + path + '): ' + err.toString())
				}
				r.total ++
			}
			return r
		})
	}

	public findFiles(dir: string, filter: string, recursive: boolean, maxResults: number): Promise<any> {

		return fs.pathExists(dir)
		.then( exists => {
			if (!exists) {
				throw new Error(dir + ' does not exist')
			}

			if (!recursive) {
				// NOT RECURSIVE
	
                return this.listFiles(dir)
                .then( (results) => {

                    if (filter !== '*') {
                        let filteredResults = []

                        for (let file of results.files){
                            
                            if (minimatch(file.name, filter, { matchBase: true }))
                                filteredResults.push(file)
                        }
                        return filteredResults
                    }
                    else {
                        return results
                    }
                })

			} else {
				// RECURSIVE

				return new Promise( (resolve, reject) => {

					let items: any[] = [] // files, directories, symlinks, etc

					let opt: any = {
						preserveSymlinks : true
					}

					klaw(dir, opt)
					.on('data', (item: any) => {
						// this.logger.error("item=", item)
						if (item.path !== dir) {
							items.push(item.path)
						}
					})
					.on('error', (err: any) => {
						reject(err)
					})
					.on('end', () => {

						try {
							let r = this.processKlawResults(items, filter, maxResults )
							resolve(r)
						} catch (err) {
							reject(err)
						}

					})

				})
			}
		})
	}


	public execScript(script: string, args: any = []): Promise<any> {
		return new Promise((resolve, reject) => {

			let stdout = '';
			let stderr = '';

			let isWin = utils.isWin()

			let outFile = this.tmpDir + '\\' + Math.random() + '.bat';

			fs.writeFileSync(outFile , script, 'utf8');

			let child: child_process.ChildProcess

			let cmd = '"' + outFile + '"'
			if (args.length > 0) {
				for (let i = 0; i < args.length; i++) {
					cmd += ' "' + args[i] + '"'
				}
			}

			if (isWin) {
				cmd = 'chcp 65001 | ' + cmd
			}

			child = child_process.exec(cmd, {
				maxBuffer: 1024 * 1024 * 2
			});

			child.stdout.on('data', (data: any) => {
				stdout += data;
			});

			child.stderr.on('data', (data: any) => {
				stderr += data;
			});

			child.on('error', (error: any) => {
				this.logger.error(error);
				stderr += error.message;
				reject(error)
			});

			child.on('exit', (code: number) => {
				this.logger.debug('EXIT ' + code);
			});

			child.on('close', (code: number) => {
				fs.unlinkSync(outFile);
				if (code === null) {
					code = 0;
				}
				resolve({exitCode: code, stdout: stdout, stderr: stderr });

			});

		})


	}



	protected processKlawResults(items: any[], filter: string, maxResults: number) {
		let r: any = {
			files: [],
			total: 0
		}

		if (filter !== '*') {
			items = items.filter(minimatch.filter(filter, {matchBase: true}))
		}

		r.total = items.length;

		if (items.length > maxResults) {
			items.splice(maxResults , items.length )
		}

		for (let i = 0; i < items.length; i++) {
			let filePath = items[i]
			let fileinfo: any = null

			try {
				fileinfo = Files.getFileStat(filePath, true)
			} catch (err) {
				let msg = 'getFileStat(' + filePath + ') : ' + err.toString()
				this.logger.error(msg)
				throw new Error( msg)
			}
			r.files.push( fileinfo )
		}
		return r
	}


}

