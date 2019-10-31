

import {ThttpPlugin} from '../ThttpPlugin'
import {WorkerApplication as Application}  from '../../WorkerApplication'
import {Files} from '../../utils/Files'
import {HttpTools} from '../../utils/HttpTools'
import fs = require('fs-extra')
import Ssh2 = require('ssh2')
import express = require('express')
import p = require('path')
import * as Errors from '../../Errors'
import * as Promise from 'bluebird'
import SshConnection from './SshConnection'
import bodyParser = require('body-parser');
import ws = require('ws');
import {SshSession} from './SshSession'
import net = require('net');
import Timer from '../../utils/Timer'
import http = require('http');
import https = require('https');

//import {HTTPAgent} from './SSHAgent'


//import genericPool = require('generic-pool');

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
	protected websocketDataServer: ws.Server
	protected sshSessions: Map<string, SshSession> = new Map()
	protected connections: Map<string, SshConnection> = new Map()
	protected purgeConnectionsTimer: Timer
	protected cachedConnectionTimeout: number = 3600
	protected purgeConnectionsTimerInterval: number = 60
	protected statInterval: number = 300
	protected lastStatDate: number = new Date().getTime()

	protected totalRequests: number = 0
	protected cacheHits: number = 0

	constructor(application: Application, config: any) {

		super(application, config);

		if (this.config.sshKeysDir) {
			this.sshKeysDir = this.config.sshKeysDir;
		} else {
			this.sshKeysDir = Application.getConfigDir() + '/sshKeys';
		}

	}

	protected onPurgeConnectionsTimer(){

		let nowTimestamp: number = new Date().getTime()

		this.connections.forEach( (connection: SshConnection, key: string) => {
			let diffSec: number = (nowTimestamp - connection.lastUse)/1000
			if (diffSec > this.cachedConnectionTimeout){
				let diffString: string = Math.round(diffSec / 60)+' min'

				this.logger.info("Destroy connection "+connection.toString()+' (inactive depuis '+diffString+')')	
				this.destroyConnection(connection)
			}

		})

		
		let diffLastStat: number = (nowTimestamp - this.lastStatDate)/1000	
			
		if (diffLastStat > this.statInterval)
		{
			let reqRate : number = Math.round( 10*this.totalRequests / diffLastStat )/10 
			let cacheHitRatio : number = 0
			if (this.totalRequests > 0)
				cacheHitRatio = Math.round( 1000*this.cacheHits / this.totalRequests )/10  

			this.logger.info("Requests rate: "+reqRate+"/sec, cacheHitRatio: "+cacheHitRatio+"%, connexions SSH en cache: "+this.connections.size)
			
			this.lastStatDate = new Date().getTime()
			this.totalRequests = 0
			this.cacheHits = 0
		}
		
	}


	public install() {

		super.install();

		this.purgeConnectionsTimer = new Timer({delay: this.purgeConnectionsTimerInterval * 1000});
		this.purgeConnectionsTimer.on(Timer.ON_TIMER, this.onPurgeConnectionsTimer.bind(this));
		this.purgeConnectionsTimer.start()

		/*var factory: any = {
			create: () => {
				return new Promise((resolve, reject) => {
					
					this.getConnection()
				})
			},
			destroy: (instance: any) => {
				return new Promise( (resolve) => {

					instance.release();
					instance.free()
					resolve()
				})
			}
		}

		var opts = {
			maxWaitingClients: 20,
			acquireTimeoutMillis: 5000,
			max: 5,
			min: 0 // minimum size of the pool
		}

		this.pools[name] = genericPool.createPool(factory, opts)*/

		this.app.use( bodyParser.json({
			limit: '500mb'
		}));
				
		this.app.get('/stats', this._stats.bind(this));
		this.app.get('/shell', this._shell.bind(this));
		this.app.post('/exec', this.exec.bind(this));
		this.app.post('/execMulti', this.execMulti.bind(this));
		this.app.get('/download', this.download.bind(this));
		this.app.get('/sftpReaddir', this.sftpReaddir.bind(this));
		this.app.post('/upload', this.upload.bind(this));
		this.app.post('/checkLogin', this.checkLogin.bind(this));
		this.app.post('/checkLogins', this.checkLogins.bind(this));

		this.app.get('/httpForward', this.httpForward.bind(this))

		this.websocketDataServer = new ws.Server({
			server: this.application.httpServer.server,
			noServer: true,
			perMessageDeflate: false,
			path: '/sshSocket', 
			verifyClient: this.verifyClient.bind(this)
		});

		this.websocketDataServer.on('connection', this.onDataConnection.bind(this));

		//this.createTcpServer()

	}

	httpForward(req: express.Request, res: express.Response, next: express.NextFunction){

		let params = HttpTools.getQueryParams(req, {
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
			url: {
				type: 'string'
			},
			method: {
				type: 'string',
				default: 'get'
			}
		})

		let sshOptions: any = {
			host: params.host,
			port: params.port,
			username: params.username,
			password: params.password
		}

		
		let isHttps: boolean
	
		if (params.url.toLowerCase().startsWith('https://')){
			isHttps = true;
		}
		else if (params.url.toLowerCase().startsWith('http://')){
			isHttps = false;
		}
		else
			throw "url incorrecte: doit commencer par https:// ou http://"

		this.getConnection(sshOptions)
		.then( (connection: SshConnection) => {

			let agent = connection.getHttpAgent(isHttps)

			let opt = {
				agent: agent,
				method: params.method.toUpperCase()
			}

			let httpObject
			if (!isHttps)
				httpObject = http
			else
				httpObject = https
			
//console.log("httpForward: " + opt.method+" "+params.url)

			httpObject.get( params.url, opt, (response: http.IncomingMessage) => {

				let data: any[] = []

				response.on('data', (chunk: any) => { 
					data.push(chunk)
				});
				response.on('end', () => {

					for (let k in response.headers){
						res.setHeader(k, response.headers[k])
					}
					res.end( Buffer.concat(data))
				});

			})
			.on('error', (err: any) => {
				console.log(err)
		 		next( err )
			});

		})
		.catch( (err: any) => {
			next(err)
		})

	}


	createTcpServer(){

		// Create and return a net.Server object, the function will be invoked when client connect to this server.
		var server = net.createServer((client: net.Socket) => {

	    	console.log('Client connect. Client local address : ' + client.localAddress + ':' + client.localPort + '. client remote address : ' + client.remoteAddress + ':' + client.remotePort);

		    //client.setEncoding('utf-8');

		    //client.setTimeout(1000);

		    // When receive client data.
		    client.on('data', (data: Buffer) => {

		        // Print received client data and length.
		        //console.log('Receive client send data : ' + data + ', data size : ' + client.bytesRead);
		        if (data.toString() === 'toto'){
		        	this.logger.error("!!!!!!!!! "+data.toString())
		        } else {

		        	this.logger.error(data)
		        	this.sshSessions.forEach( (sess: SshSession, key) => {
		        		if (sess.stream)
		        			sess.stream.write( data );
		        	})
		        }
		        

		        // Server send data back to client use client net.Socket object.
		        //client.end('Server received data : ' + data + ', send back to client data size : ' + client.bytesWritten);
		    });

		    // When client send data complete.
		    client.on('end', () => {
		        console.log('Client disconnect.');

		        // Get current connections count.
		        server.getConnections( (err: any, count: number) => {
		            if(!err)
		            {
		                // Print current connection count in server console.
		                console.log("There are %d connections now. ", count);
		            }else
		            {
		                console.error(JSON.stringify(err));
		            }

		        });
		    });

		    // When client timeout.
		    client.on('timeout', () => {
		        console.log('Client request time out. ');
		    })
		})

		// Make the server a TCP server listening on port 9999.
		server.listen(9999, () => {

		    // Get server address info.
		    var serverInfo = server.address();

		    var serverInfoJson = JSON.stringify(serverInfo);

		    console.log('TCP server listen on address : ' + serverInfoJson);

		    server.on('close', () => {
		        console.log('TCP server socket is closed.');
		    });

		    server.on('error', (error: any) =>{
		        console.error(JSON.stringify(error));
		    });

		});
	}

	public onDataConnection(conn: ws, req: any){
	
		let sshSession = new SshSession(this.application, conn, req)
		this.sshSessions.set(sshSession.id, sshSession)
		sshSession.on('close', () => {
			this.sshSessions.delete(sshSession.id)
			sshSession.removeAllListeners()
			conn.terminate()
		})
		sshSession.init()
	}

	public verifyClient(info: any, done: Function){
        
        // done(verified, code, message, headers)
        //done(false, 401, "Unauthorized to connect")
        done(true) 
    }
    

    public _stats(req: express.Request, res: express.Response, next: express.NextFunction) {
    	let r: any = {
    		connections: {
    			count: this.connections.size
    		}
    	}
    	res.json(r)		
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

	public destroyConnection(connection: SshConnection){
		connection.destroy()
		this.connections.delete(connection.id)
	}

	public getConnection(params: any, options: any = null): Promise<SshConnection> {
		try {

			this.totalRequests ++

			if (!params.port)
				params.port = this.defaultPort

			
			let connection: SshConnection

			let opt = {
				closeConnection: false,
				useCache: true
			}
			if (options) {
				Object.keys(options).forEach( (k: string) => {
					opt[k] = options[k]
				})
			}

			let useCache: boolean = (opt.useCache && (opt.closeConnection === false))
			let connectionId: string

			if (useCache)
				connectionId = SshConnection.calcId( params )

			if (useCache && this.connections.has(connectionId)) {
				this.cacheHits ++
				connection = this.connections.get(connectionId)
				connection.lastUse = new Date().getTime()
			} else {

				connection = new SshConnection(	params,
				{
					logger: this.logger,
					sshKeysDir: this.sshKeysDir,
					connectTimeout: this.connectTimeout
				})

				if (useCache) 
				{	
					this.connections.set(connectionId, connection)	
					connection.on('end', () => {
						this.destroyConnection(connection)
					})
				}

			}

			if (connection.isConnected()){
				return Promise.resolve(connection)
			} else 
			{
				return connection.connect()
				.then( (conn: Ssh2.Client) => {
					
					if (opt.closeConnection) {
						this.destroyConnection(connection)
					}
			
					return connection
				})
			}
			

		} catch (err) {
			return Promise.reject(err)
		}
	}

	/* tests */
	protected _shell(req: express.Request, res: express.Response, next: express.NextFunction){
		let params = HttpTools.getQueryParams(req, {
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

		this.getConnection(params)
		.then( (connection: SshConnection) => {
			let conn = connection.conn

			conn.shell( (err: any, stream: any) => {
			    if (err) throw err;
			    stream.on('close', function() {
			      console.log('Stream :: close');
			      
			    })
			    stream.on('data', function(data: any) {
			    	r+=data
			      	console.log("DATA" + data);
			    });
			    let count = 0;
			    let r : string = ''
			    let timer: any = setInterval( () => {
			    	stream.write('ls -l;echo exitcode=$?\n');
			    	count ++
			    	if (count >= 10){
			    		clearInterval(timer)
			    		
			    		setTimeout( () => {
			    			res.send(r)
			    			conn.end()
			    		}, 1000)
			    	}
			    }, 20)
			});
		})
		.catch(err => {
			next(err)	
		})
		
	}

	protected _exec( opt: any , sshConnection: SshConnection = null ): Promise<any> {

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
		
		return this.getConnection({
			host: opt.host,
			port: opt.port,
			username: opt.username,
			password: opt.password,
			key: opt.key,
			passphrase: opt.passphrase
		})
		.then( (connection: SshConnection) => {
			return connection.exec(opt)
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

	public sftpReaddir(req: express.Request, res: express.Response, next: express.NextFunction) {

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
			key: {
				default: null,
				type: 'string'
			},
			passphrase: {
				default: null,
				type: 'string'
			}
		})

		this.logger.info('ssh sftpReaddir path=' + params.path + ' on ' + params.host + ':' + params.port);

		let connection: SshConnection

		this.getConnection({
			host: params.host,
			username: params.username,
			password: params.password,
			key: params.key,
			passphrase: params.passphrase,
			port: params.port
		}, {useCache: false})
		.then( (result: SshConnection) => {
			connection = result
			return connection.sftpReaddir( params.path )
		})
		.then( result => {
			res.status(200).json(result);
		})
		.catch(err => {
			next(err)
		})
		.finally( () => {
			if (connection)
				connection.destroy()
		})

	}

	public getConnectionById(id: string){
		let r : any = null
		if (this.connections.has(id)){
			r = this.connections.get(id)
		}
		return r
	}

	public scpSend(host: string, username: string, password: string, key: string, passphrase: string, localPath: string, remotePath: string, port: number, opt: any = {}) {
		
		let connection: SshConnection

		return this.getConnection({
			host: host,
			username: username,
			password: password,
			key: key,
			passphrase: passphrase,
			port: port
		}, {useCache: false})
		.then( (result: SshConnection) => {
			connection = result
			return connection.scpSend(localPath, remotePath)	
		})
		.finally( () => {
			if (connection)
				connection.destroy()
		})
	}

	public scpGet(host: string, username: string, password: string, key: string, passphrase: string, localPath: string, remotePath: string, port: number) {

		let connection: SshConnection

		return this.getConnection({
			host: host,
			username: username,
			password: password,
			key: key,
			passphrase: passphrase,
			port: port
		}, {useCache: false})
		.then( (result: SshConnection) => {
			connection = result
			return connection.scpGet(localPath, remotePath)	
		})
		.finally( () => {
			if (connection)
				connection.destroy()
		})
	}


}



