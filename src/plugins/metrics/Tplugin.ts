import fs = require('fs-extra');
import { ThttpPlugin } from '../ThttpPlugin';
import {WorkerApplication as Application}  from '../../WorkerApplication'
import express = require('express');
import TbaseMetric from './TbaseMetric'
import bodyParser = require('body-parser');

export class Tplugin extends ThttpPlugin {

	public metrics: Map<string, TbaseMetric> = new Map<string, TbaseMetric>()

	constructor(application: Application, config: any) {

		super(application, config);

	}

	public install() {
		super.install();

		this.app.use( bodyParser.json({
			limit: '500mb'
		}));

		this.loadMetrics()
		.then( () => {
			this.app.get('/', this.getInfos.bind(this));
		})
	}

	public getInfos(req: express.Request, res: express.Response, next: express.NextFunction) {
		let r: any = {
			metrics: []
		}

		let baseUrl = req.protocol + '://' + req.get('host');

		this.metrics.forEach( (metric, metricName) => {
			let info = metric.getInfos()
			info.url = baseUrl + info.url
			r.metrics.push( info )
		})
		res.json(r)
	}

	public loadMetrics() {

		let dir = __dirname + '/metrics'

		return fs.readdir(dir)
		.then( (files) => {

			for (let metricName of files) {
				let metricClassPath = dir + '/' + metricName + '/Tmetric'
				try {
					let clazz = require( metricClassPath ).Tmetric
					let app: express.Application = express()
					this.app.use('/' + metricName, app)

					let metricConfig: any = {
						tmpDir: this.config.tmpDir + '/' + metricName,
						application: this.application,
						name: metricName
					}

					let metric = new clazz(app, metricConfig)
					this.logger.debug("'" + metricName + "' metric loaded")
					this.metrics.set(metricName, metric)
				} catch (err) {
					this.logger.error('Failed to load metric ' + metricClassPath, err)
				}
			}
		})
	}
	public getMetric(name: string) {
		return this.metrics.get(name)
	}



}


