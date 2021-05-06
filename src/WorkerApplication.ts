
import {Application} from './Application'
import {HttpServer} from './HttpServer';
import {ThttpPlugin} from './plugins/ThttpPlugin';
import express = require('express');
import bodyParser = require('body-parser');
import moment = require('moment');
import portscanner = require('portscanner');
import fs = require('fs-extra');
import os = require('os');
import p = require('path');
import {HttpTools} from './utils/HttpTools'
import * as Errors from './Errors'
import {Updater} from './autoUpdate/Updater'
import {TbasePlugin} from './plugins/TbasePlugin'
import {ChildProcess} from './utils/ChildProcess'
import * as utils from './utils'
import * as Bluebird from 'bluebird'
import net = require('net');
import urlParser = require('url')

export class WorkerApplication extends Application {

	public httpServer: HttpServer = null
	protected pluginsInstances: any = {}
	protected mainApi: express.Application
	protected startDate: any = moment().format('YYYY-MM-DD HH:mm:ss');

	constructor(configPath: string, opt: any = {}) {

		super(configPath, opt)
	
	}

	public start(): Promise<any> {

		this.httpServer = new HttpServer(this.config)

		this.mainApi = express();

		this.mainApi.use(bodyParser.json({
			limit: '50mb'
		}));
		this.httpServer.addExpressApplication('/api', this.mainApi);

		this.initRoutes();

		return this.httpServer.createServer()
        .then(() => {

			this.loadPlugins();

			return this.httpServer.start()
			.then( () => {
				this.logger.debug('Application started');
				return this
			})
        })

	}

	public registerExpressPlugin(mounthPath: string, app: express.Application) {
		this.httpServer.addExpressApplication(mounthPath, app);
	}

	public getUrl() {
		return this.httpServer.getUrl()
	}
	public loadPlugins() {
		Object.keys(this.config.plugins).forEach( (pluginName) => {
			let opt: any = this.config.plugins[pluginName]

			if (typeof opt.enabled === 'undefined') {
				opt.enabled = true
			}

			if (opt.enabled) {
				let classe = require('./plugins/' + pluginName + '/Tplugin').Tplugin

				opt.name = pluginName;
				opt.tmpDir = this.config.tmpDir + '/plugins/' + pluginName;
				let instance = new classe(this, opt);
				this.pluginsInstances[pluginName] = instance
				instance.install(this);
				if (instance instanceof ThttpPlugin) {
					let mountPath = '/_plugin/' + pluginName
					this.logger.info( "'" + pluginName + "' plugin mounted on " + mountPath)
					this.registerExpressPlugin('/_plugin/' + pluginName, instance.app)
				}
			}
		})

	}

	public getPluginInstance( name: string ): TbasePlugin {
		let r = null
		if (typeof this.pluginsInstances[name] !== 'undefined') {
			r = this.pluginsInstances[name]
		}
		return r
	}

	public stop(): Bluebird<any> {
		if (utils.isWin()) {
			return ChildProcess.execCmd(__dirname + '/../bin/agent.exe', ['stop', this.serviceName])
		} else {
			process.exit(99);
			//return Bluebird.resolve()
		}
	}

	public restart() {
		process.exit(98);
	}

	public initRoutes() {

		this.mainApi.get('/test', (req: express.Request, res: express.Response, next: express.NextFunction) => {

			new Promise( (resolve: Function, reject: Function) => {
				setTimeout( () => {
					resolve('OK1')
				}, 1000)
				setTimeout( () => {
					resolve('OK2')
				}, 2000)
			})
			.then( (r) => {
				this.logger.error(r)
				res.status(200).send(  r );
			})
			.catch( (err: any) => {
				this.logger.error(err.toString())
				next('Echec : ' + err.toString())
			})

			/*return ChildProcess.execCmd('dir G:\\fsdfd', [])

			.then( (result: any) => {
				if (result.exitCode > 0) {
					throw 'exitCode='+result.exitCode+' '+ result.stderr
				} 
			})
			.delay( 5000)
			.catch( (err: any) => {
				next('Echec : ' + err.toString())
			})*/
			

		});

		this.mainApi.get('/processIsRunning', (req: express.Request, res: express.Response, next: express.NextFunction) => {
			try{

				let params = HttpTools.getQueryParams(req, {
					pid: {
						type: 'integer'
					}				
				})
				
				let r: boolean = true

				try {
	            	process.kill(params.pid, 0);
	        	}
	    	    catch (e) {
		            r = (e.code === 'EPERM');
	        	}
	        	res.json({
	        		result: r
	        	})

			}catch(err: any){
				next(err)
			}
		});


		this.mainApi.get('/check', (req: express.Request, res: express.Response) => {
			this.check(req, res) 
		});

		this.mainApi.get('/checkAgent', (req: express.Request, res: express.Response) => {
			this.check(req, res) 
		});

		this.mainApi.get('/checkPort', (req: express.Request, res: express.Response, next: express.NextFunction) => {

			let params = HttpTools.getQueryParams(req, {
				port: {
					type: 'integer'
				},
				host: {
					type: 'string'
				}
			})

			portscanner.checkPortStatus(params.port, params.host, function(error: any, status: string) {
				// Status is 'open' if currently in use or 'closed' if available
				let result: any  = {
					result: null,
					error: null,
					status: status
				}
				
				if (error) {
					result.error = error
				} else {
					result.result = (status === 'open')
				}

				res.status(200).send(result);
			});

		});

		
		this.mainApi.get('/checkTcp', (req: express.Request, res: express.Response, next: express.NextFunction) => {

			let params = HttpTools.getQueryParams(req, {
				port: {
					type: 'integer'
				},
				host: {
					type: 'string'
				},
				timeout: {
					type: 'integer', 
					default:10000
				}
			})

			this.logger.info('checkTcp '+params.host+':'+params.port)

			let start = new Date()
			let u = urlParser.parse(req.url, true);
			
			for (let k in u.query){
				if (params[k] === undefined)
					params[k] = u.query[k]
			}

			let r: any  = {
				result: false,
				error: null,
				responseTime: null
			}

			let timer = setTimeout(() => {
				//this.logger.info('checktcp timeout after '+r.responseTime+' ms')
				let err = new Error('Timeout')
				err.toString = () =>{
					return 'Timeout'
				}
            	socket.destroy(err);
        	}, params.timeout);

			let socket: net.Socket = net.connect(params)
			
			socket.on('error', (err: any) =>{
				clearTimeout(timer);
				r.result = false
				r.responseTime = new Date().getTime() - start.getTime()
				r.error = err.toString() + ' after '+r.responseTime+' ms'				

				//this.logger.info('checktcp error '+err.toString()+' after '+r.responseTime+' ms')
				res.status(200).send(r);
			})
			socket.on('connect', () =>{
				clearTimeout(timer);
				r.result = true
				r.responseTime = new Date().getTime() - start.getTime()

				//this.logger.info('checktcp OK after '+r.responseTime+' ms')
				res.status(200).send(r);
				socket.destroy()
			})

		});


		this.mainApi.post('/admin/update', (req: express.Request, res: express.Response, next: express.NextFunction) => {

			let updater = new Updater(this)
			updater.onUpdateRequest(req, res, next)

		});

		this.mainApi.get('/admin/os/cpus', (req: express.Request, res: express.Response, next: express.NextFunction) => {

			let r = os.cpus();

			for (let i = 0; i < r.length; i++) {
				let cpu: any = r[i]
				cpu.total = 0;
				Object.keys(cpu.times).forEach( (k) => {
					cpu.total += cpu.times[k];
				})
			}
			res.status(200).json(r);

		});


		/**
		* Arrêt de l'application
		*/
		this.mainApi.get('/admin/stop', (req: express.Request, res: express.Response, next: express.NextFunction) => {
			this.logger.info('STOP');

			this.stop()
			.then( (result: any) => {
				if (result.exitCode === 0) {
					res.status(200).send(result);
				} else {
					res.status(500).send(result);
				}
			})
			.catch( (err) => {
				next(err);
			})

		});

		this.mainApi.get('/admin/restart', (req: express.Request, res: express.Response, next: express.NextFunction) => {

			this.logger.info('RESTART');
			res.status(200).send('Restarting');
			this.restart()

		});

		
		this.mainApi.post('/getConfig', (req: express.Request, res: express.Response, next: express.NextFunction) => {

			let r = {
				data: fs.readFileSync(this.configPath).toString()
			}
			res.status(200).json(r);

		});

		this.mainApi.post('/setConfig', (req: express.Request, res: express.Response, next: express.NextFunction) => {

			let params = HttpTools.getBodyParams(req, {
				data: {
					type: 'string'
				}
			})

			let path = this.configPath
			let tmppath = p.normalize( this.config.tmpDir + '/config.tmp.js')

			/* test de la config */
			try {
				if (fs.pathExistsSync(tmppath)) {
					fs.unlinkSync(tmppath)
				}

				fs.writeFileSync(tmppath, params.data)

				if (typeof require.cache[tmppath] !== 'undefined') {
					delete require.cache[tmppath]
				}

				let conf = require(tmppath);
				if (typeof conf.getConfig !== 'function') {
					throw new Errors.HttpError("la config ne comporte pas de fonction 'getConfig'", 400)
				}

			} catch (err) {
				throw new Errors.HttpError(err.toString(), 400)
			}

			/* ecriture config */
			fs.writeFileSync(path, params.data)
			let r = {
				data: fs.readFileSync(path).toString()
			}
			res.status(200).json(r);

		});
	}

	check(req: express.Request, res: express.Response)
	{
		let result: any = {
			status: 0,
			installDir: p.normalize(__dirname+'/..'),
			version: Application.version,
			startDate: this.startDate,
			userInfo: os.userInfo(),
			hostname: os.hostname(),
			nodeVersion: process.version,
			os:{
				platform: os.platform(),
				release: os.release()
			},
			cpus: os.cpus()
		};

		res.status(200).send( result );
	}

}
