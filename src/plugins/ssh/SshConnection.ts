
import SshError from './SshError'
import fs = require('fs-extra')
import Ssh2 = require('ssh2')
import * as Promise from 'bluebird'
import EventEmitter = require('events')
import bunyan = require('bunyan')
//import uuid = require("uuid");
import '../../utils/StringTools';
import SftpError from './SftpError'
import HttpAgent from './HttpAgent'
import HttpsAgent from './HttpsAgent'
import * as utils from '../../utils'

declare var app: any

export class SshConnection extends EventEmitter {
	protected static cachedKeys: Map<string, string> = new Map<string, string>()
	protected static allSshKeys: any[] = null
	protected static allSshKeysUpdateTime : number = null
	protected static allSshKeysTimeout : number = 1800*1000

	
	public static stats: any 

	public conn: Ssh2.Client = null

	protected sshKeysDir: string = null
	protected connectTimeout = 10000
	protected logger: bunyan = null
	protected connectionParams: any = null
	public lastUse : number = new Date().getTime()
	public id: string = null
	public httpsAgent: HttpsAgent = null;
	public httpAgent: HttpAgent = null;
	public validSshOptions: any = null
	public isInCache: boolean = false

	public poolId: string
	
	constructor(connectionParams: any, options: any) {

		super();


		if (options.logger)
			this.logger = options.logger
		else
			this.logger = app.getLogger('SshConnection')

		this.sshKeysDir = options.sshKeysDir
		this.connectTimeout = options.connectTimeout
		

		this.connectionParams = connectionParams
		
		this.id = this.calcId( connectionParams )

		if (!options.poolId)
			this.poolId = SshConnection.calcPoolId( connectionParams )  
		else
			this.poolId = options.poolId

		SshConnection.stats.createdCount ++;

		this.logger.info(this.toString()+" : ssh connection created")
		
	}
	public static clearCache(){
		SshConnection.allSshKeys = null
		SshConnection.allSshKeysUpdateTime = null
		SshConnection.cachedKeys.clear()
		
	}
	public static initStats(){
		SshConnection.stats = {
			createdCount: 0,
			destroyedCount: 0,
			acquiredCount: 0,
			releasedCount: 0,
			totalRequestsCount: 0,
			poolCacheHitsRatioPercent: null,
			connectCacheHitsRatioPercent: null,
			reqRatePerSec: null
		}
	}

	public toString(){
		return this.connectionParams.username+"@"+this.connectionParams.host
	}
	
	public calcId( params: any ): string{
		return this.connectionParams.username+'@'+this.connectionParams.host+":"+this.connectionParams.port+"_"+Math.random()*10E6
	}

	public static calcPoolId( params: any ): string{
		let hash: string = utils.md5( (params.password+params.key+params.passphrase).toString() )
		let s = params.username+'@'+params.host+":"+params.port+'_'+hash
		return s
	}
	
	public getHttpAgent( https = false )
	{
		if (https){
			if (!this.httpsAgent) {
				this.httpsAgent = new HttpsAgent(this.validSshOptions);
			}
			return this.httpsAgent
		} else {
			if (!this.httpAgent) {
				this.httpAgent = new HttpAgent(this.validSshOptions);
			}
			return this.httpAgent
		}
	}

	
	public getNewSshClient() {
		return new Ssh2.Client()
	}

	public destroy(){
		this.close()
		

		if (this.httpAgent)
			this.httpAgent.destroy()
		if (this.httpsAgent)
			this.httpsAgent.destroy()

		this.removeAllListeners()

		if (this.logger)
			this.logger.info(this.toString()+' : Connection destroyed')

		//this.logger = null
		
		SshConnection.stats.destroyedCount ++;
	}
	
	protected onClosed()
	{
		/* evenement provenant de la connection ssh */
		if (this.conn)
		{			
			this.conn.removeAllListeners()
			this.conn.destroy();
			this.conn = null
			this.emit('end')
		}
	}

	public close() {
		
		try {

			if (this.conn) {
				this.conn.end();
				this.conn.removeAllListeners()
				this.conn.destroy();
				this.conn = null
			}

		} catch (err) {
			this.conn = null
			this.logger.warn(this.toString()+' : SshConnection.close(): ' + err.toString())
		}
		
	}

	public isConnected(){
		return (this.conn !== null)
	}
	
	public connect(conn: Ssh2.Client = null): Promise<SshConnection> {

		let promise : Promise<Ssh2.Client>

		try{
			if (this.conn !== null) {
				return Promise.reject( new Error("Echec appel connect('"+this.connectionParams.username+"@"+this.connectionParams.host+"'): Déjà connecté"))
			}

			let tryPassword: boolean = ((typeof this.connectionParams.password !== 'undefined') && (this.connectionParams.password !== '') && (this.connectionParams.password !== null))
			let tryKey: boolean = ((typeof this.connectionParams.key !== 'undefined') && (this.connectionParams.key !== '') && (this.connectionParams.key !== null)) && !tryPassword
			let tryAgentKey: boolean = !tryPassword && !tryKey


			let sshOptions : any = {
				host: this.connectionParams.host,
				port: this.connectionParams.port,
				username: this.connectionParams.username,
				password: null,
				privateKey: null,
				passphrase: null
			}

			for(let k in this.connectionParams)
			{
				if (sshOptions[k] === undefined)
					sshOptions[k] = this.connectionParams[k]
			}

			if (tryPassword) {
				sshOptions.password = this.connectionParams.password
				promise = this._connect(sshOptions, conn)
			} else if (tryKey) {

				sshOptions.privateKey = this.connectionParams.key
				sshOptions.passphrase = this.connectionParams.passphrase

				promise = this._connect(sshOptions, conn)
			} else if (tryAgentKey) {

				let cacheKey = this.getSshKeyCache( sshOptions )
				
				sshOptions.passphrase = this.connectionParams.passphrase

				if (SshConnection.cachedKeys.has(cacheKey)) {

					sshOptions.privateKey = SshConnection.cachedKeys.get(cacheKey)

					promise = this._connect(sshOptions, conn)
					.catch( (err: any) => {
						this.logger.warn(this.toString()+ ': Use key cache error', err.toString().trim() )
						return this.findKeyConnection( sshOptions, conn )
					})

				} else {
					promise = this.findKeyConnection( sshOptions, conn )
				}

			}
		}catch(err){
			this.logger.error(err)
			let sshError = new SshError(err.toString(), 'connect-error')
			return Promise.reject(sshError)
		}

		return promise.then( (conn: Ssh2.Client) => {
			this.conn = conn
			
			conn.on('end', () => {
				this.logger.info(this.toString()+" : Connection end")
				this.onClosed()
			})
			conn.on('close', () => {
				this.logger.info(this.toString()+" : Connection closed")
				this.onClosed()
			})
			return this
		})


	}

	public getAllKeys():any
	{
		return new Promise((resolve, reject) => {

			let now = new Date().getTime()

			if ( (SshConnection.allSshKeys === null)|| ( (now - SshConnection.allSshKeysUpdateTime ) > SshConnection.allSshKeysTimeout) )
			{
				if (fs.existsSync(this.sshKeysDir)) 
				{
					try{

						SshConnection.allSshKeys = []
						let files = fs.readdirSync(this.sshKeysDir);

						for (let f of files) {
							let keyPath = this.sshKeysDir + '/' + f;
							if (fs.statSync(keyPath).isFile()) {
								this.logger.info("Ssh key '"+keyPath+"' loaded in cache")
								let key =  fs.readFileSync(keyPath)
								SshConnection.allSshKeys.push(key)
							}
						}
						SshConnection.allSshKeysUpdateTime = now
						
						this.logger.info(SshConnection.allSshKeys.length +" ssh keys loaded in cache.")
						resolve(SshConnection.allSshKeys)

					}catch(err){
						reject(new Error("Cannot read ssh keys: "+err.toString()))
					}

				} else {
				
					reject(new Error("SSH keys directory does not exists: '" + this.sshKeysDir + "'"));
				}
			} else {
				resolve(SshConnection.allSshKeys)
			}
		})

	}

	public findKeyConnection( sshOptions : any, conn: Ssh2.Client ): Promise<Ssh2.Client> {

		this.logger.info(this.toString()+" : findKeyConnection ...")

		return this.getAllKeys()
		.then((keys: any[]) => {

			/* search for valid key, in config.sshKeysDir directory */
			return new Promise((resolve, reject) => {

				if (keys.length > 0)
				{
					let keyFound = false
					let errors : any[] = []
					Promise.each(keys, (key, index, arrayLength) => {
						
						if (!keyFound)
						{						
							return this.getKeyConnection( sshOptions, key, conn )
							.then((result) => {
								keyFound = true
								errors = []
								resolve(result);
							})
							.catch( (err: any) => 
							{
								//this.logger.warn(this.toString()+" : key error: "+err.toString())
								errors.push(err)
							})
						} else {
							return Promise.resolve()
						}

					})
					.finally(() => 
					{
						if (!keyFound)
						{					
							let err = null

							if (errors.length > 1) 
							{

								for (let error of errors) {
									if ((error.level === 'client-socket') || (error.level === 'client-timeout')) {
										err = new SshError(error.toString(), error.level)
										break;
									}
								}
							} else 
							{
								err = new SshError(errors[0].toString(), errors[0].level)
							}
							
							if (err === null)
								err = new SshError('No valid key found', 'client-authentication')

							reject( err );

						}
					})

				} else {

					let err = new SshError('No key in sshKeys directory', 'client-authentication')
					reject( err )
				}
			})
		})
		.catch((err: any) => {
			err = new SshError(err.toString(), 'client-authentication')
			throw err 
		})

	}

	protected getSshKeyCache(sshOptions: any) {
		return sshOptions.username+'@'+sshOptions.host + ':' + sshOptions.port
	}
	protected _connect(sshOptions: any, conn: Ssh2.Client = null): Promise<Ssh2.Client> {

		let start = new Date().getTime()

		if (conn === null)
			conn = this.getNewSshClient();

		sshOptions.keepaliveCountMax = 10
		sshOptions.readyTimeout = this.connectTimeout
        
		return new Promise((resolve, reject) => {
			// Sur certaines machines AIX, connect() ne déclenche jamais les evt error ou ready. => attente infinie.
			let timeout = setTimeout( () => {

				let ellapsed: number = new Date().getTime() - start
				let errorMessage = 'CONNECT TIMEOUT on after ' + ellapsed + ' ms. '
				let err = new SshError(errorMessage, 'client-timeout') ;
				
				this.logger.error(this.toString()+' : '+errorMessage);

				try {
					conn.end();
				} catch (err) {
					this.logger.warn(this.toString()+' : getConnection: conn.end(): ' + err.toString())
				}

				reject( err );
			}, this.connectTimeout + 5000 )

			

			conn.on('error', (err: any) => {
				
				let ellapsed: number = new Date().getTime() - start

				clearTimeout(timeout)
	
				try {
					conn.end();
				} catch (err) {
					this.logger.warn(this.toString()+' : getConnection: conn.end(): ' + err.toString())
				}

				

				let errorMessage ='CONNECT ERROR after '+ellapsed+' ms. level=' + err.level + ' ' + err.toString()
				this.logger.error(  this.toString() +' : '+errorMessage );

				let level = 'connect-error'
				if ( (typeof err === 'object') && err.level) {
					level = err.level
				}

				let sshError = new SshError(errorMessage, level)
				reject(sshError);

			});

			conn.on('ready', () => {
				
				let ellapsed: number = new Date().getTime() - start

				this.validSshOptions = sshOptions

				clearTimeout(timeout)
				this.logger.info(this.toString() + ' : CONNECT OK in '+ellapsed+' ms');

				resolve( conn );

			});

			
			try {
				conn.connect(sshOptions);
			} catch (err) {
				
				clearTimeout(timeout)
				let sshError: SshError

				if (err.level) {
					sshError = new SshError(err, err.level);
				} else {
					sshError = new SshError(err, 'client-authentication');
				}
				reject(sshError);
			}

		})
	}

	protected getKeyConnection( sshOptions: any, key: string, conn: Ssh2.Client ) {

		sshOptions.privateKey = key

		return this._connect(sshOptions, conn)
		.then( conn => {

			let cacheKey = this.getSshKeyCache(sshOptions)
			SshConnection.cachedKeys.set(cacheKey, key)
			return conn
				
		})

	}



	/* COMMANDES */

	public exec(opt: any){

		let r: any = {
			host: opt.host,
			stdout: '',
			stderr: '',
			exitCode: null,
			isKilled: false
		};
		
		this.lastUse = new Date().getTime()

		return new Promise((resolve, reject) => {

			if (!this.isConnected()){
				reject('Non connecté')
			} else 
			{
				let onExec = (err: any, stream: any) => {
					

					if (err) {
						let errorMessage = 'exec : '+err.toString()
						this.logger.error(this.toString()+' : '+errorMessage)
						let sshError: SshError = new SshError( errorMessage )
						sshError.connected = true;
						this.close()
						reject( sshError )
					} else {

						stream.on('exit', (code: number, signal: string) => {

							if ((signal === 'SIGTERM') || (signal == 'SIGKILL'))
							{
								r.isKilled = true;
							}

							if (code != null) {
								r.exitCode = code;
							}

							stream.close()
							
						});

						stream.on('close', (exitCode: number) => {

							if ((typeof exitCode != 'undefined') && (exitCode !== null))
							{
								r.exitCode = exitCode;
							}

							if (r.exitCode === null) {
								let err: SshError
								if (r.isKilled) {
									err = new SshError( 'Process killed' )
								} else {
									err = new SshError( 'SSH stream closed' )
								}
								err.connected = true
								reject( err )
							} else {
								resolve(r);
							}
						});

						stream.on('data', (data: any) => {
							r.stdout += data;
						});

						stream.stderr.on('data', (data: any) => {

							//this.logger.debug('ONDATA');
							r.stderr += data;
						});
					}
				}
				
				let pty: any = (opt.pty===true)
				this.conn.exec(opt.script, {pty: pty}, onExec.bind(this));
				
			}

		})

	}


	public scpSend( localPath: string, remotePath: string, opt: any = {}) {
		
		this.lastUse = new Date().getTime()
		return new Promise((resolve, reject) => {
			
			this.conn.sftp((err: any, sftp: Ssh2.SFTPWrapper) => {
				
				if (err) {
					let errorMessage = 'scpSend '+this.toString()+": "+localPath+' -> '+this.toString()+":"+remotePath+': '+err.toString()
					this.logger.error(errorMessage)
					let sshError: SftpError = new SftpError( err )
					sshError.connected = true
					reject(sshError);
					this.close()
				} else {

					let isPartialUpload = (typeof opt.start !== "undefined") && (opt.start !== null)

					if (isPartialUpload){
						
						try{	
				
							let streamOpt: any = {
								flags: 'r+',
								start: opt.start
							}

							let stream: any = sftp.createWriteStream(remotePath, streamOpt)								
							let fileStream = fs.createReadStream(localPath)
							
							stream.on('error', (err: any) => {
								let sshError = new SftpError(err)
								sshError.connected = true
								reject(sshError);
								sftp.end()
							})

							fileStream.on('end', () => {
								resolve({
									host: this.connectionParams.host,
									port: this.connectionParams.port,
									username: this.connectionParams.username,
									remotePath: remotePath,
									localPath: localPath
								});
								sftp.end()
							})

							fileStream.pipe( stream )	

						}catch(err){
							reject(err)
							sftp.end()
						}

					} else 
					{
						sftp.fastPut(localPath, remotePath, (err2: any) => {
							sftp.end()
							if (err2) {
								let sshError = new SftpError(err2)
								sshError.connected = true
								reject(sshError);
							} else {

								resolve({
									host: this.connectionParams.host,
									port: this.connectionParams.port,
									username: this.connectionParams.username,
									remotePath: remotePath,
									localPath: localPath
								});
							}
		
						});
					}
				}
			})
		})

	}


	public scpGet( localPath: string, remotePath: string, opt: any = {}) {

		this.lastUse = new Date().getTime()

		return new Promise((resolve, reject) => {

			this.conn.sftp((err: any, sftp: Ssh2.SFTPWrapper) => {

				if (err) {

					let errorMessage = 'scpGet '+this.toString()+" "+remotePath+' -> '+this.toString()+":"+localPath+': '+err.toString()
					this.logger.error(errorMessage)
					let sshError: SftpError = new SftpError( err )
					sshError.connected = true
					reject(sshError);
					this.close()
				} else {
					let isPartialDownload = (typeof opt.start !== "undefined") && (typeof opt.end !== "undefined") && (opt.start !== null) && (opt.end !== null)

					if (isPartialDownload){
						
						try{
							let stream: any = sftp.createReadStream(remotePath, {
								start: opt.start,
								end: opt.end
							})								
							stream.on('end', () => {
								sftp.end()
							})
							resolve(stream)

						}catch(err){
							reject(err)
						}

					} else 
					{

						sftp.fastGet(remotePath, localPath, (err2: any) => {
							sftp.end()
							if (err2) {
								let sftpError: SftpError = new SftpError(err2)
								sftpError.connected = true
								reject(sftpError);
								
							} else {

								resolve({
									host: this.connectionParams.host,
									port: this.connectionParams.port,
									username: this.connectionParams.username,
									remotePath: remotePath,
									localPath: localPath
								});
							}
					
						});
					}
				}
			})
		})

	}

	public sftpReaddir( path: string) {

		this.lastUse = new Date().getTime()
		
		return new Promise((resolve, reject) => {

			this.conn.sftp((err: any, sftp: any) => {

				if (err) {
					let errorMessage = 'sftpReaddir : '+err.toString()+' '+path
					this.logger.error(errorMessage)
					let sshError: SftpError = new SftpError( err )
					sshError.connected = true
					reject(sshError);
					this.close()
				} else {

					sftp.readdir( path, (err2: any, r: any) => {
						sftp.end()
						if (err2) {
							let sftpError = new SftpError(err2)
							sftpError.connected = true
							reject(sftpError);
						} else {

							resolve({
								result: r,
								host: this.connectionParams.host,
								port: this.connectionParams.port,
								username: this.connectionParams.username,
								path: path
							});
						}
					
					});
				}
			})
		})

	}

}

SshConnection.initStats()
