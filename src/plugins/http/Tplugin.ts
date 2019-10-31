
import  {ThttpPlugin } from '../ThttpPlugin.js'
import '../../utils/StringTools'
import {WorkerApplication as Application}  from '../../WorkerApplication'
import Timer from '../../utils/Timer'
import request = require('request')
import express = require('express')
import bodyParser = require('body-parser');

export class Tplugin extends ThttpPlugin {

	protected runningRequestCount = 0
	protected requestCount = 0
	protected statTimer: Timer

	constructor(application: Application, config: any) {

		super(application, config);

		this.statTimer = new Timer({delay: 2000});
		this.statTimer.on(Timer.ON_TIMER, this.onStatTimer.bind(this));
		this.statTimer.start()
	}

	public install() {
		super.install();

		this.app.use( bodyParser.json({
			limit: '500mb'
		}));

		this.app.post('/request', this.request.bind(this));
	}

	public onStatTimer() {
		this.logger.debug('runningRequestCount : ' + this.runningRequestCount + ', total=' + this.requestCount)
	}

	public request(req: express.Request, res: express.Response) {


		let opt: any = {
			strictSSL: false,
			timeout: 5000
		}
		Object.keys(req.body).forEach( (k) => {
			opt[k] = req.body[k]
		})

		if (!opt.headers)
			opt.headers = {}

		opt.headers['user-agent'] = 'mr-agent'
		
		let startTime: number = new Date().getTime()

		this.runningRequestCount ++
		this.requestCount ++

		request(opt, (err: any, response: any, body: any) => {

				this.runningRequestCount --
				let xTime: number = new Date().getTime() - startTime;

				let r: any = {
					isError: true,
					error: null,
					rawError: null,
					body: null,
					status: null,
					xTime: xTime,
					headers: null
				}

				if (err) {
					r.isError = true;
					r.error = err.toString()
					r.rawError = err
				} else {
					r.isError = false
					r.body = body
					r.status = response.statusCode
					r.headers = response.headers
				}
				res.status(200).json(r)

		})


	}

}


