

import * as utils from './utils';
import path = require('path')
import EventEmitter = require('events');
import bunyan = require('bunyan');
import shell = require('shelljs')
import p = require('path')
const logrotate = require('logrotator');
import cluster = require('cluster')

export interface ApplicationConstructor {
	new (configPath: string, opt: any): Application;
}

export class Application extends EventEmitter {

	/* 2.6.2 : 
	- fs.deleteFiles peut supprimer des repertoires 
	- moveFile peut deplacer un repertoires
	*/
	public static version = '2.7.11'

	public static applicationDirPath: string = __dirname;

	private static _instance: Application = null

	public config: any = {}
	public serviceName = 'ctop-agent'

	protected logsConfig: any;
	protected _loggers: Map<string, bunyan> = new Map<string, bunyan>()
	protected logger: bunyan = null
	protected configPath: string = __dirname + '/../conf/config.js'
	protected rotator: any

	constructor(configPath: string, opt: any = {}) {

		super();
		
		if (arguments.length > 0) {
			if (typeof configPath === 'object') {
				opt = configPath

			} else {
				this.configPath = configPath
			}
		}

		this.configPath = p.normalize(this.configPath)
		this.config = require(this.configPath).getConfig()
		this.config = utils.array_replace_recursive(this.config, opt)
		
		if (cluster.isMaster)
		{			
			this.rotator = logrotate.rotator;
	       
	        this.rotator.on('error', (err: any) => {
	        	console.log("Process "+process.pid+': logrotator error : '+err.toString());
	        });

	        // 'rotate' event is invoked whenever a registered file gets rotated
	        this.rotator.on('rotate', (file: string) => {
	        	console.log("Process "+process.pid+': file ' + file + ' was rotated!');
	        });
		}


		if (this.config.getLoggerFunction) {
			this.getLogger = opt.getLoggerFunction
		}

		this.logger = this.getLogger(this.constructor.name)

		if (!this.config.dataDir) {
			this.config.dataDir = __dirname + '/../data';
		} else {
			this.config.dataDir = utils.replaceEnvVars(this.config.dataDir);
		}


		if (!this.config.tmpDir) {
			this.config.tmpDir = __dirname + '/../tmp';
		} else {
			this.config.tmpDir = utils.replaceEnvVars(this.config.tmpDir);
		}

		try {
			shell.mkdir('-p', this.config.tmpDir);
		} catch (e) {
			if ( e.code !== 'EEXIST' ) { throw e; }
		}
		try {
			shell.mkdir('-p', this.config.dataDir);
		} catch (e) {
			if ( e.code !== 'EEXIST' ) { throw e; }
		}

		
	}

	public static create(clazz: ApplicationConstructor , configPath: string, opt: any = {}): Application {
		if (Application._instance) {
			throw new Error('Application already created')
		}

		Application._instance = new clazz(configPath, opt)
		return Application._instance

	}

	public static getInstance(): Application {
		return Application._instance
	}

	public static getLogger(name: string = null) {

		if (!Application._instance) {
			throw new Error('Application is not created')
		}
		return Application._instance.getLogger(name)
	}

	public static getConfigDir() {
		return p.normalize( __dirname + '/../conf' )
	}

	public start(): Promise<any> {
		return Promise.resolve( this )
	}
	public getTmpDir() {
		return this.config.tmpDir
	}
	public getLogger(name: string = null) {

		if (name === null) {
			name = 'Main';
		}

		if (!this._loggers.has(name)) {


			let loggerConf = this.getLogsConfig().logger
			loggerConf.name = name;
			this._loggers.set(name,  bunyan.createLogger(loggerConf) );
		}

		return this._loggers.get(name);
	}

	public getDefaultLogConfig() {
		let r =  {
			'http-access-log': {
				'enabled': true,
				'log-name': 'access.log',
				'log-dir': __dirname + '/../logs',
				'options': {
					'size' : '10M',
					'maxFiles' : 7
				}
			},
			'logger': {
				'level': 'info',
				'streams': [
					{
						"stream": process.stdout
					}
					,{
						"type": "logrotator",
						"path": __dirname+"/../logs/log.json",
						"schedule": '1m', 
						"size": '50m', 
						"compress": false, 
						"count": 30 
					}
					/*{
						'type': 'rotating-file',
						'period': '1d',
						'count': 7,
						'path': __dirname + '/../logs/log.json'
					}*/
				]
			}
		}

		return r;

	}


	public getLogsConfig() {

		if (!this.logsConfig) {
			this.logsConfig = {}

			if (!this.config.logs) {
				this.logsConfig = this.getDefaultLogConfig()

			} else {
				if (!this.config.logs['http-access-log']) {
					this.logsConfig['http-access-log'] = this.getDefaultLogConfig()['http-access-log']
				} else {
					this.logsConfig['http-access-log'] = this.config.logs['http-access-log']
				}

				if (!this.config.logs.logger) {
					this.logsConfig.logger = this.getDefaultLogConfig().logger
				} else {
					this.logsConfig.logger = this.config.logs.logger
				}
			}


			if (typeof this.logsConfig['http-access-log'] !== 'undefined') {
				/* remplacement variables d'env dans les chemins des logs */
				let dir = utils.replaceEnvVars(this.logsConfig['http-access-log']['log-dir']);
				this.logsConfig['http-access-log']['log-dir'] = dir
				try {
					shell.mkdir('-p', dir);
				} catch (e) {
					if ( e.code !== 'EEXIST' ) { throw e; }
				}
			}

			if (typeof this.logsConfig.logger !== 'undefined') {
				for (let i = 0; i < this.logsConfig.logger.streams.length; i++) {
					let stream = this.logsConfig.logger.streams[i]
					if (stream.path) {
						stream.path = utils.replaceEnvVars(stream.path);
						stream.path = stream.path.replace('${PID}', process.pid)

						let dir: string = path.dirname(stream.path)

						try {
							shell.mkdir('-p', dir);
						} catch (e) {
							if ( e.code !== 'EEXIST' ) { throw e; }
						}

						
						if (stream.type === 'logrotator')
						{							
                            let params = {                     
                                "schedule": stream.schedule, 
                                "size": stream.size, 
                                "compress": stream.compress, 
                                "count": stream.count
                            }
                            
                            if (cluster.isMaster){
								this.rotator.register(stream.path,  params);
                            }

                            this.logsConfig.logger.streams[i] = {
                                "type": "file",
                                "path": stream.path
                            }
                           
						}


					}
				}
			}
		}
		
		return this.logsConfig;
	}





}




