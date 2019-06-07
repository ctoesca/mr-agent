
import  {ThttpPlugin } from '../ThttpPlugin.js'
import '../../utils/StringTools'
import {WorkerApplication as Application}  from '../../WorkerApplication'
import * as Errors  from '../../Errors'
import {HttpTools}  from '../../utils/HttpTools'
import express = require('express')
import dns = require('dns')
import bodyParser = require('body-parser');

export class Tplugin extends ThttpPlugin {

	protected ipHash: Map<string, any> = new Map<string, any>()

	constructor(application: Application, config: any) {

		super(application, config);

		if (this.config.dnsServers && (this.config.dnsServers.length > 0)) {
			dns.setServers(this.config.dnsServers)
		}

	}

	public install() {
		super.install();

		this.app.use( bodyParser.json({
			limit: '500mb'
		}));

		this.app.get('/dnsReverse', this.dnsReverse.bind(this))
	}

	public dnsReverse(req: express.Request, res: express.Response, next: express.NextFunction) {

		let params = HttpTools.getQueryParams(req, {
			ip: {
				type: 'string'
			}
		})

		if (!this.ipHash.has(params.ip)) {

			dns.reverse(params.ip, (err: any, hostnames: string[]) => {

				let r: any = {
					ip: params.ip,
					hostnames: []
				}

				if (!err) {
					r.hostnames = hostnames
					this.ipHash.set(params.ip, r)
				} else if (err.code != 'ENOTFOUND') {
					next ( new Errors.HttpError(err.toString(), 500))
					return
				}
				// [ 'par21s05-in-f131.1e100.net', 'par21s05-in-f3.1e100.net' ]

				res.status(200).json(r)

			})

		} else {
			res.status(200).json(this.ipHash.get(params.ip))
		}
	}


}


