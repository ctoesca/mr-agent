

import {Application} from './Application';
import * as Errors from './Errors'
import * as utils from './utils';
import EventEmitter = require('events');
import bunyan = require('bunyan');
import express = require('express');
import http = require('http');
import https = require('https');
import pem = require('pem');
import auth = require('basic-auth')
import morgan = require('morgan')

const rfs = require('rotating-file-stream')


export class HttpServer extends EventEmitter {

	public config: any = {}
	public auth: any = null
	public port = 3000
	public allowedIp = '.*'
	public bindAddress = '0.0.0.0'
	public httpsOptions: any = {
		'enabled': true,
		'pathOpenSSL': null, // si non défini, openssl doit être dans le PATH de la machine.
		'days': 5000, // days is the certificate expire time in days
		'selfSigned': true
	}
	public requestTimeout = 0
	public app: express.Application
	public server: any
	protected mainApi: express.Application
	protected logger: bunyan = null
	// protected _onBeforeRequest: any[] = []

	constructor(config: any) {

		super();

		this.config = config;
		this.logger = Application.getLogger( this.constructor.name )

		if (arguments.length > 0) {

			if ((typeof this.config.auth !== 'undefined') && (typeof this.config.auth.username !== 'undefined') && (typeof this.config.auth.password !== 'undefined')) {
				this.auth = this.config.auth;
			}

			if (typeof this.config.port !== 'undefined') {
				this.port = this.config.port;
			}

			if (typeof this.config.allowedIp !== 'undefined') {
				this.allowedIp = this.config.allowedIp;
			}

			if (typeof this.config.bindAddress !== 'undefined') {
				this.bindAddress = this.config.bindAddress;
			}

			if (typeof this.config.https !== 'undefined') {
				Object.keys(this.config.https).forEach( (k) => {
					this.httpsOptions[k] = this.config.https[k]
				});
			}

			if (typeof this.config.requestTimeout !== 'undefined') {
				this.requestTimeout = this.config.requestTimeout;
			}
		}

		if (this.allowedIp === null) {
			this.logger.warn("Vérification de l'adresse IP désactivée");
		} else {
			this.logger.info('Allowed IP: ' + this.allowedIp);
		}

		if (this.auth === null) {
			this.logger.warn('Basic auth désactivé');
		} else {
			this.logger.info('Basic auth activé');
		}

		if ((this.allowedIp === null) && (this.auth === null)) {
			this.logger.error("Basic Auth et Vérification IP désactivés: l'agent ne sera pas utilisable");
		}

		this.app = express();

		if (this.config.logs && this.config.logs['http-access-log'] ) {
			let c: any = this.config.logs['http-access-log'];
			if (c.enabled) {
				this.logger.info('Activation logging HTTP acces', c)
				c.options.path = c['log-dir']
				let logName: string = c['log-name']
				let accessLogStream = rfs( logName, c.options)
				this.app.use(morgan('combined', {stream: accessLogStream}))
			}
		}


		this.app.use(this.authRequest.bind(this));
        
        /* curl PHP envoi parfois le header 'Expect: 100-continue' (sur post, qd la requete depasse une certaine taille, sur header multipart - upload etc)
        Dans ce cas, nodejs envoie writeContinue(), mais si on envoie la réponse immédiatement (avevc res.json(...) par exemple,  curl PHP ne 'reçoit jamais la réponse'.
  		en cas de 100-continue, on met une tempo avant de traiter la requete.
  		note: le fait de mettre 'Expect:' dans curl Php ne change rien.

  		Mais si on renvoie pas une reponse dans le callback express directement, ça fonctionne. 
        */
        /*this.app.use( (req: express.Request, res: express.Response, next: express.NextFunction)=>{
			if (req.headers["expect"] === '100-continue'){
				//res.writeContinue() // par défaut, nodejs renvoie déjà 100-continue
				setTimeout( ()=>{
					next()
				}, 200)
			} else {
				next()
			}
		})*/

        this.createServer()
        /*.then((server) => {
			
        	server.on('checkContinue', (req: express.Request, res: express.Response) => {
        		// la requete n'est pas traitée si on passe ici - https://nodejs.org/api/http.html#http_event_checkcontinue
        		this.logger.error("CHECK CONTINUE")
        		res.writeContinue()
        	})
        })*/
	}

	public addExpressApplication(mounthPath: string, app: express.Application) {
		this.app.use(mounthPath, app);
	}

	public ipIsAllowed( ip: string ): boolean {
		if (this.allowedIp === null) {
			return false
		} else {
			return new RegExp(this.allowedIp).test(ip);
		}
	}

	public setErrorsHandlers() {

		this.app.use(function (req: express.Request, res: express.Response, next: express.NextFunction) {
			let err = new Errors.NotFound('Not Found');
			next(err);
		});

		this.app.use(function (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) {
			let response: any
			let status = 500;

			try {

				if (err instanceof Errors.HttpError) {
					status = err.code;
				} else if (typeof err["getHttpStatus"] === 'function') {
					status = err["getHttpStatus"]();
				}

				if (status >= 500) {					
					this.logger.error('***** ' + status + ' : ' + req.method + ' ' + req.path, err);
				} else {
					this.logger.warn('***** ' + status + ' : ' + req.method + ' ' + req.path, err.toString());
				}

				this.logger.debug('***** ' + status + ' : ' + req.method + ' ' + req.path, err);
				

				if (!res.headersSent) 
				{
					response = {
						error: true,
						errorMessage: err.toString(),
						code: status,
						errorNum: 1,
						errorClass: err.constructor.name,
						stack: err.stack
					}
					if (typeof err["getDetail"] !== 'undefined') {
						response.detail = err["getDetail"]()
					}
					res.set('x-error', err.toString())
					res.status(status)	
					res.send(response)

				} else {
					this.logger.warn('***** ErrorHandler: Cannot set headers after they are sent to the client.')
				}
			} catch (err) {
				this.logger.error('HttpServer.onError: ' , err)
				if (!res.headersSent && response) 
				{
					res.status(status)	
					res.send(response)
				}
			}
		}.bind(this));

	}

	public authRequest(req: express.Request, res: express.Response, next: express.NextFunction) {
		let ip = utils.getIpClient(req);
		let authok = false;

		let IPok = this.ipIsAllowed(ip);

		if (!IPok) {
			let user = auth(req);
			authok = this.auth && user && (user.name === this.auth.username) && (user.pass === this.auth.password)

			if (authok) {
				// logger.debug("authok="+authok+", IPok="+IPok+", user=",user)
				authok = true
			}
		} else {
			authok = true;
		}

		if (authok) {
			return next();
		} else {
			if (this.auth) {
				res.setHeader('WWW-Authenticate', 'Basic realm="mr-agent-realm"');
			}
			this.logger.warn('401 - Unauthorized ip=' + ip + ', user=' + auth(req));
			throw new Errors.HttpError('Unauthorized', 401);
		}
	}
	public getUrl() {
		let r = ''
		if (this.httpsOptions.enabled) {
			r = 'https://'
		} else {
			r = 'http://'
		}
		if (this.bindAddress === '0.0.0.0') {
			r += '127.0.0.1'
		} else {
			r += this.bindAddress
		}

		r += ':' + this.port

		return r
	}

	public start() {
		this.server.setTimeout( this.requestTimeout * 1000 );
		return this.listen();	
	}

	protected createServer(){

		if (!this.httpsOptions.enabled) {
			this.server = http.createServer(this.app)
			this.server.keepAliveTimeout = 0
			return Promise.resolve(this.server)		
		} else {

			this.logger.info('https Options=', this.httpsOptions)

			if (this.httpsOptions.pathOpenSSL) {
				pem.config({
					pathOpenSSL: this.httpsOptions.pathOpenSSL
				});
			}

			if (this.httpsOptions.credentials) {

				this.server = https.createServer(this.httpsOptions.credentials, this.app);
				this.server.keepAliveTimeout = 0
				return Promise.resolve(this.server)		
			} else {

				return new Promise( (resolve: Function, reject: Function) => {

					pem.createCertificate(this.httpsOptions, (err: any, keys: any) => {

						if (err) {
							this.logger.error(err, 'createCertificate')
							process.exit(1)
						} else {

							let credentials = {key: keys.serviceKey, cert: keys.certificate};

							require('fs').writeFileSync(this.config.tmpDir + '/key.txt',  keys.serviceKey)
							require('fs').writeFileSync(this.config.tmpDir + '/cert.pem',  keys.certificate)
							this.logger.info("Le certificat HTTPS a été généré")
							//this.logger.debug(credentials.key)
							//this.logger.debug(credentials.cert)

							this.server = https.createServer(credentials, this.app);		
							resolve(this.server)
						}

					});
				})

			}
		}

	}
	protected listen() {

		return new Promise( (resolve, reject) => {

			this.server.on('error', (e: any) => {
				if (e.code === 'EADDRINUSE') {
					this.logger.error('Port ' + this.port + ' in use');
					process.exit(1)
				} else {
					this.logger.error(e);
					reject(e)
				}
			});

			this.server.listen(this.port, this.bindAddress, () => {
				this.setErrorsHandlers()
				this.logger.info('API Server started listening on ' + this.bindAddress + ':' + this.port);
				resolve()
			});
		})
	}

}




