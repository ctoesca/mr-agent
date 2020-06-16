
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

export default class SshConnection extends EventEmitter {
	protected static cachedKeys: Map<string, string> = new Map<string, string>()
	
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

		this.logger = options.logger
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
	
	public connect(): Promise<SshConnection> {

		if (this.conn !== null) {
			return Promise.reject( new Error("Echec appel connect('"+this.connectionParams.username+"@"+this.connectionParams.host+"'): Déjà connecté"))
		}

		let tryPassword: boolean = ((typeof this.connectionParams.password !== 'undefined') && (this.connectionParams.password !== '') && (this.connectionParams.password !== null))
		let tryKey: boolean = ((typeof this.connectionParams.key !== 'undefined') && (this.connectionParams.key !== '') && (this.connectionParams.key !== null)) && !tryPassword
		let tryAgentKey: boolean = !tryPassword && !tryKey

		let promise : Promise<Ssh2.Client>

		

		let sshOptions : any = {
			host: this.connectionParams.host,
			port: this.connectionParams.port,
			username: this.connectionParams.username,
		}

		if (tryPassword) {
			sshOptions.password = this.connectionParams.password
			promise = this._connect(sshOptions)
		} else if (tryKey) {

			sshOptions.privateKey = this.connectionParams.key
			sshOptions.passphrase = this.connectionParams.passphrase

			promise = this._connect(sshOptions)
		} else if (tryAgentKey) {

			let cacheKey = this.getSshKeyCache( sshOptions.host,  sshOptions.port)
			
			sshOptions.passphrase = this.connectionParams.passphrase

			if (SshConnection.cachedKeys.has(cacheKey)) {

				sshOptions.privateKey = SshConnection.cachedKeys.get(cacheKey)

				promise = this._connect(sshOptions)
				.catch( (err: any) => {
					this.logger.warn(this.toString()+ ': Use key cache error', err.toString().trim() )
					return this.findKeyConnection( sshOptions )
				})

			} else {
				promise = this.findKeyConnection( sshOptions )
			}

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



	public findKeyConnection( sshOptions : any ): Promise<Ssh2.Client> {

		/* search for valid key, in config.sshKeysDir directory */
		return new Promise((resolve, reject) => {

			if (fs.existsSync(this.sshKeysDir)) {

				let promises = [];

				let files = fs.readdirSync(this.sshKeysDir);

				for (let f of files) {
					let keyPath = this.sshKeysDir + '/' + f;
					if (fs.statSync(keyPath).isFile()) {

						promises.push( this.getKeyConnection( sshOptions, keyPath ) )
					}
				}

				if (promises.length > 0) {

					Promise.any(promises)
					.then( ( result: any ) => {
						/*
						result = {
							key: key,
							sshOptions: sshOptions,
							conn: conn
						} */
						resolve(result);
					})
					.catch( (error: any) => {
						// AggregatedError (bluebird)

						let level = error.level

						if (error instanceof Promise.AggregateError) {

							error = error[0]
							level = error.level

							if (error.length > 1) {
								for (let i = 0; i < error.length; i++) {
									if ((error[i].level === 'client-socket') || (error[i].level === 'client-timeout')) {
										error = error[i];
										level = error.level
										break;
									}
								}
							}
						}

						let err: SshError = new SshError(error.toString(), level)
						reject( err );
					})

				} else {

					let err = new SshError('No valid key found', 'client-authentication')
					reject( err )
				}

			} else {
				let err = new SshError("SSH keys directory does not exists: '" + this.sshKeysDir + "'", 'client-authentication')
				reject(err);
			}

		})
	}
	protected getSshKeyCache(host: string, port: number) {
		return host + ':' + port
	}
	protected _connect(sshOptions: any): Promise<Ssh2.Client> {

		let start = new Date().getTime()

		let conn = this.getNewSshClient();

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

	protected getKeyConnection( sshOptions: any, keyPath: string ) {

		let key =  require('fs').readFileSync(keyPath)

		sshOptions.privateKey = key

		return this._connect(sshOptions)
		.then( conn => {

			let cacheKey = this.getSshKeyCache(sshOptions.host, sshOptions.port)
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
