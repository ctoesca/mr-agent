
import {SshError} from './SshError'
import fs = require('fs-extra')
import Ssh2 = require('ssh2')
import * as Promise from 'bluebird'
import EventEmitter = require('events')
import bunyan = require('bunyan')



export default class SshConnection extends EventEmitter {
	protected static cachedKeys: Map<string, string> = new Map<string, string>()

	protected sshKeysDir: string = null
	protected defaultPort = 22
	protected connectTimeout = 10000
	protected logger: bunyan = null
	public conn: Ssh2.Client = null

	constructor(config: any) {

		super();

		this.logger = config.logger
		this.sshKeysDir = config.sshKeysDir
		this.defaultPort = config.defaultPort
		this.connectTimeout = config.connectTimeout

	}

	public getNewSshClient() {
		return new Ssh2.Client()
	}

	public close() {
		if (this.conn) {			
			try {
				this.conn.end();
				this.conn = null
			} catch (err) {
				this.logger.warn('SshConnection.close(): ' + err.toString())
			}
		}
	}

	public connect(params: any): Promise<Ssh2.Client> {
		
		if (this.conn !== null)
			this.close()

		let tryPassword: boolean = ((typeof params.password !== 'undefined') && (params.password !== null))
		let tryKey: boolean = ((typeof params.key !== 'undefined') && (params.key !== null)) && !tryPassword
		let tryAgentKey: boolean = !tryPassword && !tryKey

		let promise: Promise<Ssh2.Client>

		if (tryPassword) {
			promise = this._connect({
				host: params.host,
				port: params.port,
				username: params.username,
				password: params.password
			})
		}
		else if (tryKey) {
			promise = this._connect({
				host: params.host,
				port: params.port,
				username: params.username,
				privateKey: params.key,
				passphrase: params.passphrase
			})
		}
		else if (tryAgentKey) {

			let cacheKey = this.getSshKeyCache( params.host,  params.port)

			if (SshConnection.cachedKeys.has(cacheKey)) {
				let key = SshConnection.cachedKeys.get(cacheKey)
				
				promise = this._connect({
						host: params.host,
						port: params.port,
						username: params.username,
						privateKey: key,
						passphrase: params.passphrase
					})
					.catch( (err: any) => {
						this.logger.warn('Use key cache error', err.toString().trim() )
						return this.findKeyConnection(params.host, params.port, params.username, params.passphrase)
					})
				
			} else {

				promise = this.findKeyConnection(params.host, params.port, params.username, params.passphrase)
			}

		}

		return promise.then( (conn: Ssh2.Client) => {
			this.conn = conn
			return conn
		})
		

	}

	public findKeyConnection(host: string, port: number, username: string, passphrase: string): Promise<Ssh2.Client> {

		/* search for valid key, in config.sshKeysDir directory */
		return new Promise((resolve, reject) => {

			if (fs.existsSync(this.sshKeysDir)) {

				let promises = [];

				let files = fs.readdirSync(this.sshKeysDir);

				for (let f of files) {
					let keyPath = this.sshKeysDir + '/' + f;
					if (fs.statSync(keyPath).isFile()) {

						promises.push( this.getKeyConnection( host, port, username, keyPath, passphrase ) )
					}
				}

				if (promises.length > 0) {

					Promise.any(promises)
					.then( ( conn ) => {
						resolve(conn);
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
	protected _connect(params: any): Promise<Ssh2.Client> {
		let conn = this.getNewSshClient();
	
		params.keepaliveCountMax = 10
		params.readyTimeout = this.connectTimeout

		return new Promise((resolve, reject) => {
			// Sur certaines machines AIX, connect() ne déclenche jamais les evt error ou ready. => attente infinie.
			let timeout = setTimeout( () => {
				let err = new SshError('connect timeout on ' + params.host + ':' + params.port + ' after ' + (this.connectTimeout + 5000) + ' ms', 'client-timeout') ;

				try {
					conn.end();
				} catch (err) {
					this.logger.warn('getConnection: conn.end(): ' + err.toString())
				}

				reject( err );
			}, this.connectTimeout + 5000 )


			conn.on('error', (err: any) => {
				clearTimeout(timeout)

				this.logger.error(params.username + '@' + params.host + ': CONNECT ERROR.', 'level=' + err.level + ' ' + err.toString());
				let level = 'connect-error'
				if ( (typeof err === 'object') && err.level) {
					level = err.level
				}

				let sshError = new SshError(err, level)
				reject(sshError);
			
			});

			conn.on('ready', () => {
				clearTimeout(timeout)
				this.logger.info(params.username + '@' + params.host + ': CONNECT OK');
				
				resolve( conn );

			});

			try {
				conn.connect(params);
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

	protected getKeyConnection( host: string, port: number, username: string, keyPath: string, passphrase: string ) {
		
		let key =  require('fs').readFileSync(keyPath)
		return this._connect({
			host: host,
			port: port,
			username: username,
			privateKey: key,
			passphrase: passphrase
		})
		.then( conn => {
			
			let cacheKey = this.getSshKeyCache(host, port)
			SshConnection.cachedKeys.set(cacheKey, key)
			
			return conn
		})

	}
}
