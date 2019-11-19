
import {SshError} from './SshError'
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

export default class SshConnection extends EventEmitter {
	protected static cachedKeys: Map<string, string> = new Map<string, string>()
	public conn: Ssh2.Client = null

	protected sshKeysDir: string = null
	protected connectTimeout = 10000
	protected logger: bunyan = null
	protected connectPromise : Promise<Ssh2.Client>	
	protected connectionParams: any = null
	public lastUse : number = new Date().getTime()
	public id: string = null
	public httpsAgent: HttpsAgent = null;
	public httpAgent: HttpAgent = null;
	public validSshOptions: any = null

	constructor(connectionParams: any, options: any) {

		super();

		this.logger = options.logger
		this.sshKeysDir = options.sshKeysDir
		this.connectTimeout = options.connectTimeout
		
		this.connectionParams = connectionParams
		this.id = SshConnection.calcId( connectionParams )
	}

	public toString(){
		return this.connectionParams.username+"@"+this.connectionParams.host
	}
	
	public static calcId( params: any ): string{
		let s = params.host+"_"+params.port+"_"+params.username+"_"+params.password+"_"+params.key+"_"+params.passphrase
		return s.hashCode().toString()
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
	}

	public close() {
		try {
			if (this.conn) {
				this.conn.end();
				this.conn = null
			}
			this.connectPromise = null
		} catch (err) {
			this.logger.warn('SshConnection.close(): ' + err.toString())
		}
		
	}
	public isConnected(){
		return (this.conn !== null)
	}
	
	public connect(): Promise<Ssh2.Client> {

		if (this.connectPromise)
			return this.connectPromise

		if (this.conn !== null) {
			this.close()
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
			
			this.logger.error( sshOptions )

			if (SshConnection.cachedKeys.has(cacheKey)) {

				let key = SshConnection.cachedKeys.get(cacheKey)
				sshOptions.privateKey = key
				sshOptions.passphrase = this.connectionParams.passphrase

				promise = this._connect(sshOptions)
				.catch( (err: any) => {
					this.logger.warn('Use key cache error', err.toString().trim() )
					return this.findKeyConnection( sshOptions )
				})

			} else {
				
				sshOptions.passphrase = this.connectionParams.passphrase
				promise = this.findKeyConnection( sshOptions )
			}

		}

		this.connectPromise = promise.then( (conn: Ssh2.Client) => {
			this.conn = conn
			this.connectPromise = null

			conn.on('end', () => {
				this.conn = null
				this.emit('end')
			})

			return conn
		})
		.catch( (err: any) =>{
			this.connectPromise = null
			throw err
		})

		return this.connectPromise

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
		let conn = this.getNewSshClient();

		sshOptions.keepaliveCountMax = 10
		sshOptions.readyTimeout = this.connectTimeout

		return new Promise((resolve, reject) => {
			// Sur certaines machines AIX, connect() ne déclenche jamais les evt error ou ready. => attente infinie.
			let timeout = setTimeout( () => {
				let err = new SshError('connect timeout on ' + sshOptions.host + ':' + sshOptions.port + ' after ' + (this.connectTimeout + 5000) + ' ms', 'client-timeout') ;

				try {
					conn.end();
				} catch (err) {
					this.logger.warn('getConnection: conn.end(): ' + err.toString())
				}

				reject( err );
			}, this.connectTimeout + 5000 )


			conn.on('error', (err: any) => {
				clearTimeout(timeout)

				this.logger.error(sshOptions.username + '@' + sshOptions.host + ': CONNECT ERROR.', 'level=' + err.level + ' ' + err.toString());
				let level = 'connect-error'
				if ( (typeof err === 'object') && err.level) {
					level = err.level
				}

				let sshError = new SshError(err, level)
				reject(sshError);

			});

			conn.on('ready', () => {

				this.validSshOptions = sshOptions

				clearTimeout(timeout)
				this.logger.info(sshOptions.username + '@' + sshOptions.host + ': CONNECT OK');

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
				throw sshError;
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

		return new Promise((resolve, reject) => {

			if (!this.isConnected()){
				reject('Non connecté')
			} else 
			{
				let onExec = (err: any, stream: any) => {
					if (err) {
						
						let sshError: SshError = new SshError( this.connectionParams.username+'@'+this.connectionParams.host+' exec : '+err.toString() )
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

							this.logger.debug('ONDATA');
							r.stderr += data;
						});
					}
				}

				if (opt.pty) {
					this.conn.exec(opt.script, {pty: true}, onExec.bind(this));
				} else {					
					this.conn.exec(opt.script, onExec.bind(this));
				}
				
			}

		})
	}


	public scpSend( localPath: string, remotePath: string, opt: any = {}) {
		
		
		return new Promise((resolve, reject) => {
			
			this.conn.sftp((err: any, sftp: any) => {
				if (err) {
					let sshError: SshError = new SshError( this.connectionParams.username+'@'+this.connectionParams.host+' scpSend : '+err.toString() )
					sshError.connected = true
					reject(sshError);
					this.close()
				} else {
					sftp.fastPut(localPath, remotePath, (err2: any) => {
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
			})
		})
		
	}


	public scpGet( localPath: string, remotePath: string) {

		return new Promise((resolve, reject) => {
		
			this.conn.sftp((err: any, sftp: any) => {
				if (err) {
					let sshError: SshError = new SshError( this.connectionParams.username+'@'+this.connectionParams.host+' scpGet : '+err.toString() )
					sshError.connected = true
					reject(sshError);
					this.close()
				} else {
					sftp.fastGet(remotePath, localPath, (err2: any) => {
						if (err2) {
							let sftpError: SftpError = new SftpError(err2)
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
			})
		})
		
	}

	public sftpReaddir( path: string) {

		return new Promise((resolve, reject) => {
				
			this.conn.sftp((err: any, sftp: any) => {
				if (err) {
					let sshError: SshError = new SshError( this.connectionParams.username+'@'+this.connectionParams.host+' sftpReaddir : '+err.toString() )
					sshError.connected = true
					reject(sshError);
					this.close()
				} else {
					sftp.readdir( path, (err2: any, r: any) => {

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
