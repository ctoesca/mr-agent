
import {ThttpPlugin} from '../ThttpPlugin.js'
import Timer from '../../utils/Timer'
import {WorkerApplication as Application}  from '../../WorkerApplication'
import {TbaseProcessor} from './TbaseProcessor'
import elasticsearch = require('elasticsearch')
import moment = require('moment')
import glob = require('glob')
import express = require('express')
import urlParser = require('url')
import request = require('request')
import bodyParser = require('body-parser');

export class Tplugin extends ThttpPlugin {

	public statTimerIterval = 0;
	public canProcessLocal = false;
	public currentRemoteAgent = 0;
	public loadbalance: string[] = ['local']
	protected statTimer: Timer = null
	protected processors: any = {};
	protected elasticClient: elasticsearch.Client

	protected totalCreated = 0
	protected createRate = 0
	protected totalInput = 0
	protected tauxRejet = 0

	protected lastStat: Date = null

	constructor(application: Application, config: any) {
		super( application, config );
		this.statTimerIterval = 2;
		this.canProcessLocal = false;
		this.currentRemoteAgent = 0;
		this.loadbalance = ['local']
		if (this.config && this.config.loadbalance) {
			this.loadbalance = config.loadbalance
		}
		this.logger.info('logingest nodes: ', this.loadbalance)
	}

	public install() {

		super.install();


		this.statTimer = new Timer({delay: this.statTimerIterval * 1000});
		this.statTimer.on(Timer.ON_TIMER, this.onStatTimer.bind(this));
		this.statTimer.start();

		this.elasticClient = new elasticsearch.Client(this.config.elasticsearch);

		this.app.use( function( req, res, next) {
			// filebeat envoie content-type="application/json" alors que c'est plusieurs objets json séparés par des \n :
			//  on force l'utilisation de bodyParser.text() en mettant 'content-type' = "text/plain"
			//
			let u = urlParser.parse(req.url, true);
			if (u.pathname === '/_bulk') {
				req.headers['content-type'] = 'text/plain';
			}

			next();
		});

		this.app.use( bodyParser.text({
			limit: '500mb'
		}));
		this.app.use( bodyParser.json({
			limit: '500mb'
		}));
		this.app.post('/_bulk', this.ingestData.bind(this));
		this.app.head('/', this.head.bind(this));
		this.app.get('/', this.getRoot.bind(this));
		this.app.get('/_template/:templateName', this.getTemplate.bind(this));


		glob(__dirname + '/processors/*.js', {}, (err: any, files: string[]) => {
			if (!err) {

				for (let i = 0; i < files.length; i++) {
					let filename = files[i].rightRightOf('/');
					let processorName = filename.substring(0, filename.length - 3);
					let classe = require('./processors/' + processorName + '.js').Tprocessor;
					let opt = null;
					if (this.config.processors && this.config.processors[processorName]) {
						opt = this.config.processors[processorName];
					}

					this.processors[processorName] = new classe(processorName, opt);
				}

			} else  {
				this.logger.error(err)
			}
		});

	}

	/*public preProcess(req: express.Request, res: express.Response) {
	}*/

	public onStatTimer() {
		if (this.lastStat) {
			let now = new Date();
			let diff = now.getTime() - this.lastStat.getTime();

			this.createRate = Math.round( (this.totalCreated / (diff / 1000)) * 10 ) / 10;
			this.tauxRejet =  Math.round( (100 * (this.totalInput - this.totalCreated) / this.totalInput) * 10 ) / 10;

			if (this.createRate > 0) {
				process.send({
					'logIngestStats': {
						createRate: this.createRate,
						tauxRejet: this.tauxRejet,
						totalCreated: this.totalCreated,
						totalInput: this.totalInput
					}
				});
				// this.logger.info( "INGEST RATE="+this.createRate+"/sec, REJETS="+this.tauxRejet+"%, created="+this.totalCreated+"/"+this.totalInput);
			}

			this.lastStat = new Date();
			this.totalCreated = 0;
			this.totalInput = 0;

		} else {
			this.lastStat = new Date();
		}

	}

	public getTemplate(req: express.Request, res: express.Response) {
		res.send({})
	}

	public getRoot(req: express.Request, res: express.Response) {
		res.send({})
	}
	public ingestData(req: express.Request, res: express.Response) {

		this.currentRemoteAgent ++;

		if (this.currentRemoteAgent >= this.loadbalance.length) {
			this.currentRemoteAgent = 0;
		}

		if (this.loadbalance[ this.currentRemoteAgent ] === 'local') {
			this.canProcessLocal = true;
			this.localIngestData(req, res)
		} else {
			let url = this.loadbalance[ this.currentRemoteAgent ]
			this.remoteIngestData(url, req, res)
			.catch( (err: any) => {
				if (this.canProcessLocal) {
					this.logger.warn('remoteIngestData ' + url + ' (les données vont être traitées en local): ' + err.toString())
					this.localIngestData(req, res)
				} else {
					this.logger.error('remoteIngestData ' + url + ' (les données se seront pas traitées en local): ' + err.toString())
				}
			})
		}

	}

	public remoteIngestData( url: string, req: express.Request, res: express.Response ) {
		return new Promise((resolve: Function, reject: Function) => {
			let options = {
				url: url,
				strictSSL: false,
				json: false,
				method: req.method,
				body: req.body,
				headers : req.headers
			}

			request(
				options,
				(err: any, response: any, body: any) => {

					if (!err && (response.statusCode >= 400) ) {
						err = body
					}

					if (err) {
						reject(err)
					} else {
						res.send(response)
						resolve(response)
					}
				}
				)
		})
	}

	public localIngestData(req: express.Request, res: express.Response) {
		// this.preProcess(req, res);

		let lines = req.body.split('\n');

		let count = 0;
		let dataCount = 0;
		let promises = []

		for (let i = 0; i < lines.length; i++) {
			if (lines[i] !== '') {
				let isData = ( (i + 1) % 2 === 0);

				if (isData) {
					dataCount ++;
					let data: any

					try {

						data = JSON.parse( lines[i] );

					} catch (err) {
						this.logger.debug('error parsing json data: ', err);
						res.status(500).send(err);
						return;
					}

					if (typeof data.type !== 'string') {

						if (typeof data.fields.type !== 'string') {
							let mess = 'type field is ' + typeof data.type;
							this.logger.debug(mess, data);
							res.status(400).send(mess);
							return;
						} else {
							data.type = data.fields.type
						}

					}

					if (typeof this.processors[data.type] === 'undefined') {
						this.logger.error('no processor found for type ' + data.type);
					} else {
						promises.push( this.processMessage(this.processors[data.type], data) )
					}
				} else {
					// console.log( lines[i] )
				}
			}
		}

		Promise.all( promises )
		.then( (messages: any[]) => {
			let body = [];
			for (let i = 0; i < messages.length; i++) {
				let message = messages[i]

				if (message) {

					/* local_time */
					message.local_time = moment(message['@timestamp']).format('YYYY-MM-DD HH:mm:ss');

					body.push({
						'index' : {
							'_index' : message._indexName,
							'_type' : message.type
						}
					});

					message._indexName = undefined

					body.push(  message );
					count ++;
				}
			}

			if (count > 0) {
				/*if (body.length > 0)
				this.logger.debug("@timestamp: ", body[body.length-1]["@timestamp"]);*/

				this.bulk(body).then(
					(result: any) => {
						this.totalCreated += result.createdCount;
						this.totalInput += dataCount;
						this.logger.debug('created: ' + result.createdCount + '/' + dataCount);

						res.status(200).send(result);
					},
					(error: any) => {
						console.log( 'bulk error', error);
						res.status(200).send(error);
					});

			} else {
				res.status(200).send({});
			}

		})
		.catch( (err: any) => {
			this.logger.error('ingestData error : ' + err.toString());
			res.status(500).send(err);
		})
	}



	public processMessage( processor: TbaseProcessor, data: any ): Promise<any> {

		return processor.getMessage(data)
		.catch( (err: any) => {
			let logMessage = 'error=' + err + ' '

			if (data.fields) {
				Object.keys(data.fields).forEach( (k) => {
					logMessage += 'fields.' + k + '=' + data.fields[k] + ' ';
				})
			}

			if (data.host) {
				logMessage += 'host=' + data.host + ' ';
			}

			if (data.beat && data.beat.hostname) {
				logMessage += 'beat.hostname=' + data.beat.hostname + ' ';
			}

			if (data.origin) {
				logMessage += 'origin=' + data.origin + ' ';
			}

			if (data.source) {
				logMessage += 'source=' + data.source + ' ';
			}

			logMessage += 'message=' + data.message;

			logMessage = 'Erreur processMessage ' + processor.name + ': ' + logMessage

			/* on ne veut pas risque de logger dans l'agent, un message qui serait rejeté et génèrerait à nouveau un message d'erreur etc.. (erreur récursive qui planterait l'agent). */
			if (processor.name !== 'bunyan') {
				this.logger.warn(logMessage)
			} else {
				console.log(logMessage)
			}
			return false
		})
	}

	public bulk(body: any) {

		return new Promise( (resolve: Function, reject: Function)  => {

			if (body.length === 0 ) {
				resolve({
					items: [],
					errors: false,
					createdCount: 0
				});
			} else {

				this.elasticClient.bulk({
					body: body
					// consistency: "one",
				},  (err: any, resp: any) => {

					if (!err) {
						let sendOk = 0;

						if (!resp.items) {
							reject(resp);
						} else {

							if (resp.errors) {

								try {

									for (let i = 0; i < resp.items.length; i++) {
										if ( !resp.items[i].create ||  (resp.items[i].create.status >= 400) ) {
											this.logger.debug('error: ', JSON.stringify(resp.items[i]));
										} else {
											sendOk ++;
										}

									}

								} catch (err2) {
									this.logger.debug(err2, resp.items);
								}

							} else {
								sendOk = resp.items.length;

							}


							resp.createdCount = sendOk;

							if (sendOk > 0) {
								resolve(resp);
							} else {
								reject(resp);
							}

						}

					} else {

						this.logger.debug({err: err}, 'Echec bulk elasticSearch: ' + err.toString());
						reject(err);

					}
				}
				);
			}

		})

	}

	public head(req: express.Request, res: express.Response) {

		// this.preProcess(req, res);
		res.status(200).send('ok');


	}



}
