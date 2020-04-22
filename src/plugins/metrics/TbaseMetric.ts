
import IbaseMetric from './IbaseMetric'
import express = require('express')
import url = require('url')
import fs = require('fs-extra')
import bunyan = require('bunyan')
import {WorkerApplication as Application} from '../../WorkerApplication'
import Promise = require('bluebird')
import os = require('os');

export default class TbaseMetric implements IbaseMetric {
	public name: any = null;

	protected app: express.Application = null;
	protected config: any = null;
	protected application: Application;
	protected logger: bunyan;

	constructor(expressApp: express.Application, config: any) {
		this.app = expressApp
		this.config = config
		this.name = config.name
		this.application = config.application
		this.logger = Application.getLogger(this.constructor.name + '.' + this.name);

		fs.ensureDir(this.config.tmpDir)

		this.app.get( '/', this.getRequest.bind(this));
	}

	public format( format: string, params: any, result: any ): any {
		return '0|OK'
	}

	public getInfos(): any {

		return {
			name: this.name,
			url: this.app.path(),
			args: []
		}
	}

	public getRequest( req: express.Request, res: express.Response, next: express.NextFunction ) {
		let u = url.parse(req.url, true);

		let isForNagios = (u.query.format === 'nagios')

		this.get(u.query)
		.then( r => {
			if (isForNagios) {
				res.contentType('text/plain')
				res.send(this.format('nagios', u.query, r))
			} else {
				r.host = os.hostname()
				res.json(r)
			}
		})
		.catch( (err: any) => {

			if (isForNagios) {
				res.contentType('text/plain')
				res.send('3|' + err.toString())
			} else {
				next(err)
			}
		})
	}

	public convertBytesToGo(v: number) {
		if (v < 1024 * 1024 * 10) {
			// < 10Mo
			return Math.round( 1000 * v / 1024 / 1024 / 1024 ) / 1000
		} else if (v < 1024 * 1024 * 100) {
			// < 100Mo
			return Math.round( 100 * v / 1024 / 1024 / 1024 ) / 100
		} else {
			// > 100Mo
			return Math.round( 10 * v / 1024 / 1024 / 1024 ) / 10
		}
	}

	public get( args: any = null ): Promise<any> {
		return Promise.resolve({})
	}


}


