

import {ThttpPlugin} from '../ThttpPlugin'
import {WorkerApplication as Application}  from '../../WorkerApplication'
import {Files} from '../../utils/Files'
import {HttpTools} from '../../utils/HttpTools'
import fs = require('fs-extra')
import express = require('express')
import p = require('path')
import * as Errors from '../../Errors'
import * as Promise from 'bluebird'
import {SshConnection} from './SshConnection'
import SshError from './SshError'
import bodyParser = require('body-parser');
import ws = require('ws');
import {SshSession} from './SshSession'
import net = require('net');
import Timer from '../../utils/Timer'
import http = require('http');
import https = require('https');
import os = require('os');
import genericPool = require('generic-pool');
import * as utils from '../../utils'
const gzip = require('zlib')
//const compression = require('compression')
import SftpError from './SftpError'

export class Tplugin extends ThttpPlugin {

	public sshKeysDir: string = null
	public connectTimeout = 10000

	protected defaultPort = 22
	protected websocketDataServer: ws.Server
	protected sshSessions: Map<string, SshSession> = new Map()
	protected pooledConnections: Map<string, SshConnection> = new Map()

	/* stats */
	protected statTimer: Timer
	protected statTimerInterval: number = 60
	protected statInterval: number = 300
	protected lastStatDate: number = new Date().getTime()
	protected currentRequestsCount: number = 0
	protected poolCacheHits: number = 0
	protected connectCacheHits: number = 0
	
	protected createdPools: number = 0


	/* pools de connexions ssh */
	public pools: Map<string, genericPool.Pool<SshConnection> > = new Map()

	public poolsOptions : any = {
		acquireTimeoutMillis: 5000,
		evictionRunIntervalMillis: 60*1000,
		maxWaitingClients: 20,
		idleTimeoutMillis: 3600*1000,
		numTestsPerEvictionRun: 200,
		max: 5, 
			/*!! 1 connection par host-user-pass-key. sur Vm ou on se connecte avec 10 comptes différents, avec 2 agents / 2 workers par parent:
			Nombre de connections potentielles si max=5:
				5 * 10 * 2 * 2 = 200 connexions ouvertes sur la VM

			max: prendre en compte le fait que si la VM n'est pas accessible, un objet 'SshConnection' est retenur pendant 10 sec
			     Si plusieurs appels en //, l'appel de aquire() peut être en timeout (acquireTimeoutMillis), ou bien maxWaitingClients peut être atteint
			*/

		min: 0,
		Promise: Promise
	}

	constructor(application: Application, config: any) {

		super(application, config);

		if (this.config.sshKeysDir) {
			this.sshKeysDir = this.config.sshKeysDir;
		} else {
			this.sshKeysDir = Application.getConfigDir() + '/sshKeys';
		}

	}

	protected onStatTimer(){
		let nowTimestamp = new Date().getTime()
		
		let diffLastStat: number = (nowTimestamp - this.lastStatDate)/1000	
		let reqRate : number = Math.round( 10*this.currentRequestsCount / diffLastStat )/10 
		let poolCacheHitRatio : number = 0
		let connectCacheHitRatio : number = 0

		if (this.currentRequestsCount > 0){
			poolCacheHitRatio = Math.round( 1000*this.poolCacheHits / this.currentRequestsCount )/10  
			connectCacheHitRatio = Math.round( 1000*this.connectCacheHits / this.currentRequestsCount )/10  
		}

		this.lastStatDate = new Date().getTime()
		this.currentRequestsCount = 0
		this.poolCacheHits = 0
		this.connectCacheHits = 0

		

		SshConnection.stats.poolCacheHitsRatioPercent = poolCacheHitRatio
		SshConnection.stats.connectCacheHitsRatioPercent = connectCacheHitRatio

		SshConnection.stats.reqRatePerSec = reqRate
		
	
		if (diffLastStat >= 300)
		{
			this.logger.info("Requests rate: "+reqRate+"/sec, poolCacheHitRatio: "+poolCacheHitRatio+"% connectCacheHitRatio: "+connectCacheHitRatio+"%")
			this.getStats()
			.then( (stats: any) => {
				this.logger.info('POOLS STATS pid '+process.pid +' => size: '+stats.poolsStats.connectionsSize+', available: '+stats.poolsStats.connectionsAvailable+', borrowed: '+stats.poolsStats.connectionsBorrowed+', pending: '+stats.poolsStats.connectionsPending)
				
			})
		}


	}
	
	razCache(){
		this.logger.info("RAZ Cache ...")

		SshConnection.clearCache()
		this.logger.info("Cached ssh keys removed")

		this.pooledConnections.forEach( (connection: SshConnection, id: string) => {
			connection.destroy()
			this.pooledConnections.delete(id)
		})
			
		/*this.pools.forEach( (pool: genericPool.Pool<SshConnection>, id: string) => {
			pool.clear()
		})*/
		this.pools.clear()

		return Promise.resolve({
			result: true
		})

	}

	getStats(){
		let r: any = {	
			pid: process.pid,
			sshConnections: SshConnection.stats,
			poolsStats:{
				
				createdPools: this.createdPools,
				poolsCount: this.pools.size,
				connectionsBorrowed: 0,
				connectionsPending: 0,
				connectionsSize: 0,
				connectionsAvailable: 0
			}		
		}		

    	this.pools.forEach( (pool: genericPool.Pool<SshConnection>, id) => {
			
			r.poolsStats.connectionsBorrowed += pool.borrowed
			r.poolsStats.connectionsPending += pool.pending
			r.poolsStats.connectionsSize += pool.size
			r.poolsStats.connectionsAvailable += pool.available

			/*r.poolsStats.pools[id] = {
				spareResourceCapacity: pool.spareResourceCapacity,
				size: pool.size,
				available: pool.available,
				borrowed: pool.borrowed,
				pending: pool.pending,
				max: pool.max,
				min: pool.min
			}*/
		})

		return Promise.resolve(r)
	}
	public install() {

		super.install();

		this.statTimer = new Timer({delay: this.statTimerInterval * 1000});
		this.statTimer.on(Timer.ON_TIMER, this.onStatTimer.bind(this));
		this.statTimer.start()

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
		
		//this.app.use(compression())		


		this.app.get('/stats', this._stats.bind(this));
		this.app.get('/shell', this._shell.bind(this));

		this.app.post('/fileinfo', this.fileinfoRequest.bind(this));
		
		this.app.post('/exec', this.exec.bind(this));

		this.app.post('/execMulti', this.execMulti.bind(this));
		this.app.get('/download', this.download.bind(this));
		this.app.get('/sftpReaddir', this.sftpReaddir.bind(this));
		this.app.post('/upload', this.upload.bind(this));
		this.app.post('/checkLogin', this.checkLogin.bind(this));
		this.app.post('/checkLogins', this.checkLogins.bind(this));
		this.app.post('/razCache', this._razCache.bind(this));

		this.app.post('/addPrivateKey', this.addPrivateKey.bind(this));
		this.app.post('/removeAllPrivateKeys', this.removeAllPrivateKeys.bind(this));
		this.app.post('/removePrivateKey', this.removePrivateKey.bind(this));


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




	addPrivateKey(req: express.Request, res: express.Response, next: express.NextFunction)
	{
		let params = HttpTools.getBodyParams(req, {
			content: {
				type: 'string'
			},
			filename: {
				type: 'string'
			}
		})

		let keyPath = this.sshKeysDir+'/'+params.filename
		let r: any = {
			added: [],
			updated: []
		}

		if (!fs.existsSync(this.sshKeysDir))
		{
			fs.mkdirpSync(this.sshKeysDir)
		}
		
		if (!fs.existsSync(keyPath))
		{
			r.added.push(params.filename)
		} else {
			r.updated.push(params.filename)
		}
		
		fs.writeFileSync(keyPath, params.content)
		SshConnection.clearCache()
		res.status(200).json(r);

	}

	removeAllPrivateKeys(req: express.Request, res: express.Response, next: express.NextFunction)
	{
		let r: any = {
			removed: []
		}
		if (fs.existsSync(this.sshKeysDir)){
			let files = fs.readdirSync(this.sshKeysDir);

			for (let f of files) {
				let keyPath = this.sshKeysDir + '/' + f;
				if (fs.statSync(keyPath).isFile()) 
				{
					fs.removeSync(keyPath)
					r.removed.push(f)
				}
			}
			SshConnection.clearCache()
		}
		
		res.status(200).json(r);
	}
	
	removePrivateKey(req: express.Request, res: express.Response, next: express.NextFunction)
	{
		let params = HttpTools.getBodyParams(req, {
			filename: {
				type: 'string'
			}
		})
		
		let keyPath = this.sshKeysDir+'/'+params.filename
		let r: any ={
			removed: []
		}
		if (fs.existsSync(keyPath)){
			fs.removeSync(keyPath)
			r.removed.push(params.filename)
			SshConnection.clearCache()
		}
		
		res.status(200).json(r);

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

		let connection : SshConnection

		this.getConnection(sshOptions)
		.then( (result: SshConnection) => {

			connection = result
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
		.finally( () => {		
			this.releaseSshConnection( connection )
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

		        this.sshSessions.forEach( (sess: SshSession, key) => {
		        	if (sess.stream)
		        		sess.stream.write( data );
		        })

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
	
		let sshSession = new SshSession(this, this.application, conn, req)
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
    	
    	this.getStats()
    	.then( (result: any) => {
    		res.json(result)		    		
    	})
    	.catch( (err: any) => {
    		next(err)
    	})

    }
    _razCache(req: express.Request, res: express.Response, next: express.NextFunction){
		this.razCache()
    	.then( (result: any) => {
    		res.json(result)		    		
    	})
    	.catch( (err: any) => {
    		next(err)
    	})
	}

	public upload(req: express.Request, res: express.Response, next: express.NextFunction) {
		let params: any = {}
		let isPartialUpload: boolean

		var onBeforeSaveFile = (fields: any, opt: any, filename: string) => {

			try{
				
				for(let k in fields){
					params[k] = fields[k].val
				}

				params = utils.parseParams(params, {
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
					},
					start:{
						default: null,
						type: 'integer'
					}
				})
				isPartialUpload = (params.start !== null) 

				if (isPartialUpload)
					params.overwrite = true

				this.logger.info('Upload filename='+filename+' . '+params.path+'@'+ params.host + ' , overwrite = ' + params.overwrite+', start='+params.start)
		
				return Promise.resolve(opt)		

			}catch(err){
				return Promise.reject(err)
			}
		}

		let uploadedFile: any = null
		
		let opt: any = {}	
		

		return HttpTools.saveUploadedFile(req, res, next, {
			onBeforeSaveFile: onBeforeSaveFile
		})
		.then( (result: any) => {
			
			if (isPartialUpload)
				opt.start = params.start

			uploadedFile = result.files[0]
			this.logger.info('Upload: file [' + uploadedFile.name + '] saved');

			if (!params.overwrite && !isPartialUpload)
			{
				return this.remoteFileExists(params.host, params.username, params.password, params.key, params.passphrase, params.path, params.port)
			} else {
				return Promise.resolve(null)
			}
		})
		.then((fileExists: boolean = null) => {

			if (fileExists === true) 
			{
				throw new Errors.BadRequest('File already exists: ' + params.path + ' (use \'overwrite\' option)', 400)
			}

			return this.scpSend(params.host, params.username, params.password, params.key, params.passphrase, uploadedFile.path, params.path, params.port, opt)

		})
		.then((result: any) => {
			
			this.logger.info('scpSend OK : ' + params.path+'@'+params.host );
			
			if (isPartialUpload)
				res.set('x-start-position', params.start)
		
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
			if (uploadedFile) {
				this.removeTempFileSync( uploadedFile.path )
			}
		})
		.catch( (err: any) => {
			next(err);
		})

	}
	public fileinfo(opt: any){

		let params = utils.parseParams(opt, {
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

		let cmd: string = 'ls -ltFLd --time-style="+%Y-%m-%d %H:%M:%S" "'+params.path+'"'

		return this._exec({
			host: params.host,
			username: params.username,
			password: params.password,
			key : params.key ,
			passphrase: params.passphrase,
			script: cmd,
			port: params.port,
			logError: true,
			pty: false,
			useCachedConnection: true
		})
		.then( (result: any) => {
			
			let r : any
			if (result.exitCode === 0) 
			{
            	result.stdout = result.stdout.trim()
            	if (result.stdout === ''){
            		let sshError: SshError = new SshError( "fileinfo: la commande ls n'a pas renvoyé de résultat" )
					sshError.connected = true
                	throw sshError
            	}

                r = this.getFileObjectFromLsLineResult(result.stdout);
            }
        	else 
        	{
        		let errorMessage : string = result.stder
            	if (result.stderr.toLowerCase().contains("permission")) 
            	{
                	errorMessage = "Permission error : "+errorMessage;
            	} 

           	 	let sshError: SshError = new SshError( errorMessage )
				sshError.connected = true
                throw sshError
           	}
           	return r
		})

	}

	protected getFileObjectFromLsLineResult(line: string, regexp: any = null){
		
		let file: any = {}

        line = line.replace(/\s+/, ' ')
        let fields = line.split(' ')
        
        file.date = fields[5]+" "+fields[6];
        file.name = line.rightOf(file.date+" ");

        if (regexp)
        {
        	if (typeof regexp === 'string')
        		regexp = new RegExp(regexp);
        }

        if (!regexp || file.name.match(regexp)) {
            file.rights = fields[0];
            file.type = file.rights[0]
            file.isFile = false;
            file.isLink = false;
            file.isDir = false;

            if (file.type == "d") {
                file.isDir = true;
            } else if (file.type == "l") {
                file.isLink = true;
            } else {
                file.isFile = true;
            }
                 
            file.owner = fields[2];
            file.group = fields[3];
            file.size = fields[4];

            if (file.name.endsWith('/')) {
                file.name = file.name.substring(0, file.name.length - 1);
            }
            if (file.name.endsWith("*")) {
                file.name = file.name.substring(0, file.name.length - 1);
                file.executable = true;
            } else {
                file.executable = false;
            }
        }

        return file;
		
	}

	public remoteFileExists(host: string, username: string, password: string, key: string, passphrase: string, remotePath: string, port: number) {
		let filename = p.basename(remotePath)
		let rep = p.dirname(remotePath)

		let script = `cd ${rep}
		if [ $? -ne 0 ]; then
		exit 99
		fi
		ls "${filename}"
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
			},
			start: {
				default: null,
				type: 'integer'
			},
			end: {
				default: null,
				type: 'integer'
			}
		})

		this.logger.info('ssh download remotePath=' + params.path + ' on ' + params.host + ':' + params.port + ', compress=' + params.compress+", start="+params.start+", end="+params.end);

		let filename = Files.getFileName(params.path);
		
		let isPartialDownload = (params.start !== null) && (params.end !== null)

		if (isPartialDownload)
		{
			let opt: any = {
				start: params.start,
				end: params.end,
			}

			let connection: SshConnection

			this.getConnection({
				host: params.host,
				username: params.username,
				password: params.password,
				key: params.key,
				passphrase: params.passphrase,
				port: params.port
			}, {useCache: true})
			.then( (result: SshConnection) => {
				connection = result
				return connection.scpGet(null, params.path, opt)	
			})
			.then((readStream: any) => {
				let headerSent = false
				res.set('x-start-position', params.start)
				res.set('x-end-position', params.end)
				
				readStream.on('data', (data: any) => {
					if (!headerSent)
					{								
						if (params.compress)
							res.attachment( filename+'.gz')
						else
							res.attachment( filename )

						headerSent = true
					}
				})

				readStream.on('error', (err: any) => {
					let sftpError: SftpError = new SftpError(err)
					sftpError.connected = true
					next(sftpError)
				})	
				
				if (params.compress){
					let compressor = gzip.createGzip();
					readStream.pipe( compressor ).pipe( res )	
				}
				else{
					readStream.pipe( res )
				}
			})
			.catch( err => {
				next(err)
			})
			.finally( () => {	
				this.releaseSshConnection( connection )
			})
		
		} 
		else 
		{
			let localdir = this.tmpDir + '/' + Math.random();
			let localPath = localdir + '/' + filename;

			fs.ensureDirSync(localdir);

			this.scpGet(params.host, params.username, params.password, params.key, params.passphrase, localPath, params.path, params.port)
			.then( (result: any) => 
			{
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
							next(new Errors.HttpError( err.toString() ))
						}
					})
				}
			})
			.catch( err => {
				next(err)
			})
		}
		
		

	}
	
	public fileinfoRequest(req: express.Request, res: express.Response, next: express.NextFunction) {

		
		this.fileinfo(req.body)
		.then( (result: any) => {
			
			res.status(200).json(result);
		})
		.catch(err => {
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
			},
			useCachedConnection: {
				type: 'boolean',
				default: true
			}
		})

		this._exec(params)
		.then( (result: any) => {
			
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

		let connection: SshConnection

		this.getConnection(params)
		.then( (result: SshConnection) => {
			connection = result
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
		.finally( () => {		
			this.releaseSshConnection( connection )
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
		
		let connection: SshConnection

		return this.getConnection(params)
		.then( (result: SshConnection) => {
			connection = result
			return {result: true, params: params, error: null }
		})
		.catch( (err: any ) => {
			if (err.level === 'client-authentication') {
				return {result: false, params: params, error: err }
			} else {
				throw err
			}
		})
		.finally( () => {		
			this.releaseSshConnection( connection )
		})
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

		let connection: SshConnection

		this.getConnection(params)
		.then( (result: SshConnection) => {

			connection = result
			let conn = connection.conn

			conn.shell( (err: any, stream: any) => {
			    if (err) {
			    	next(err);
			    } else {

				    stream.on('close', function() {				     
						this.releaseSshConnection( connection )
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
			    }
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
			passphrase: null,
			useCachedConnection: true
		}
		Object.keys(defaultOpt).forEach( key => {
			if (typeof opt[key] === 'undefined') {
				opt[key] = defaultOpt[key]
			}
		})
		
		let connection: SshConnection
		let start: number = new Date().getTime()
		
		this.logger.info("EXEC script on "+opt.host+", username:"+opt.username)

		return this.getConnection({
			host: opt.host,
			port: opt.port,
			username: opt.username,
			password: opt.password,
			key: opt.key,
			passphrase: opt.passphrase
		}, {useCache: opt.useCachedConnection})
		.then( (result: SshConnection) => {
			
			connection = result
			return connection.exec(opt)
		})
		.then( (result: any) => {
			let executionTime = new Date().getTime() - start 
			this.logger.info(connection.toString()+' : Succès exec ssh ('+executionTime+' ms)');
			return result
		})
		.finally( () => {		
			this.releaseSshConnection( connection )
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
		}, {useCache: true})
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
			this.releaseSshConnection( connection )
		})

	}

	public scpSend(host: string, username: string, password: string, key: string, passphrase: string, localPath: string, remotePath: string, port: number, opt: any = {}) {
		
		let connection: SshConnection
		let params = {
			host: host,
			username: username,
			password: password,
			key: key,
			passphrase: passphrase,
			port: port
		}

		return this.getConnection(params, {useCache: true})
		.then( (result: SshConnection) => {
			connection = result
			
			return connection.scpSend(localPath, remotePath, opt)	
		})
		.finally( () => {		
			this.releaseSshConnection( connection )
		})
		
	}

	public scpGet(host: string, username: string, password: string, key: string, passphrase: string, localPath: string, remotePath: string, port: number, opt: any = {}) {

		let connection: SshConnection

		return this.getConnection({
			host: host,
			username: username,
			password: password,
			key: key,
			passphrase: passphrase,
			port: port
		}, {useCache: true})
		.then( (result: SshConnection) => {
			connection = result
			return connection.scpGet(localPath, remotePath, opt)	
		})
		.finally( () => {		
			this.releaseSshConnection( connection )
		})
	}

	public getConnection(params: any, options: any = null): Promise<SshConnection> {
		try {

			this.currentRequestsCount ++
			SshConnection.stats.totalRequestsCount ++

			if (!params.port)
				params.port = this.defaultPort

			let opt = {
				useCache: true
			}
			if (options) {
				Object.keys(options).forEach( (k: string) => {
					opt[k] = options[k]
				})
			}
		
			if (opt.useCache) {

				let poolId: string = SshConnection.calcPoolId( params )
				
				let pool: any = this.getConnectionPool(poolId, params)
				let connection: SshConnection

				return pool.acquire()
				.then( (result: any) => {
					connection = result
					
					SshConnection.stats.acquiredCount ++;

					if (!connection.isConnected()){
						return connection.connect()				
					} else {
						this.connectCacheHits ++
						return connection
					}
				})
				.catch( (err: any) => {
					
					this.releaseSshConnection(connection)
					
					if (!(err instanceof SshError)) {					
						let message = 'Cannot acquire ssh connection on pool ' + poolId + ': ' + err.toString() + ' (host: '+os.hostname()+', worker: ' +process.pid + ')'
						throw new Error(message)
					} else {
						throw err
					}

				})
			} else {

				let connection: SshConnection = this.createSshConnection(params, null)
				return connection.connect()
			}

		} catch (err) {
			return Promise.reject(err)
		}
	}


	public createSshConnection(params: any, poolId: any = null, options: any = {} ): SshConnection
	{
		let opt: any = {		
			logger: this.logger,
			sshKeysDir: this.sshKeysDir,
			connectTimeout: this.connectTimeout
		}
		for (let k in options)
			opt[k] = options[k]

		if (poolId)
			opt["poolId"] = poolId

		let connection = new SshConnection(params, opt )

		if (poolId){
			this.pooledConnections.set(poolId+"_"+connection.id, connection)
			connection.isInCache = true
		}
		return connection

	}

	public getConnectionPool(poolId: string, params: any): genericPool.Pool<SshConnection> {

		if (this.pools.has(poolId)) {
			this.poolCacheHits ++
			return this.pools.get(poolId )
		} else {

			let start = new Date().getTime()

			this.logger.info("Creating ssh pool '" + poolId + "' (max size: " + this.poolsOptions.max + ')')

			let factory: any = {
				create: () => {
					return this.createSshConnection(params, poolId)
				},
				destroy: (connection: SshConnection) => {
					if (connection.destroy){
						connection.destroy()
						this.pooledConnections.delete(connection.id)
					}
					return Promise.resolve(connection)
				}
			}

			let pool: genericPool.Pool<SshConnection> = genericPool.createPool(factory, this.poolsOptions)
			this.pools.set( poolId, pool )
			this.createdPools  ++
		
			let ellapsed = new Date().getTime() - start 
			this.logger.info("Pool created in "+ellapsed+' ms')

			return pool

		}

	}
	
	public releaseSshConnection( connection: SshConnection ) {
		if (!connection)
			return;

		if (connection.isInCache)
		{
			if (this.pools.has(connection.poolId)) 
			{
				let pool: genericPool.Pool<SshConnection> = this.pools.get(connection.poolId)
	            if (pool.isBorrowedResource(connection)){
	            	pool.release(connection)
	            	.then( () => {
	            		SshConnection.stats.releasedCount ++;
	            	})
	            }
	            /*else{
	            	this.logger.warn("releaseSshConnection "+connection.toString()+" : connection is not in the pool "+connection.poolId)
	            }*/
				
			}
		}
		else {
			connection.destroy()
		}
		
	}

}



