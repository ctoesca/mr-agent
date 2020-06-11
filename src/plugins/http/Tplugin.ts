
import  {ThttpPlugin } from '../ThttpPlugin.js'
import '../../utils/StringTools'
import {WorkerApplication as Application}  from '../../WorkerApplication'
import * as utils from '../../utils'
import request = require('request')
import express = require('express')
//import fs = require('fs')
import bodyParser = require('body-parser');
import Timer from '../../utils/Timer'
import {HttpTools} from '../../utils/HttpTools'
//import urlParser = require('url')
import * as Errors from '../../Errors'
import * as Promise from 'bluebird'
import url = require('url')
import qs = require('qs');

export class Tplugin extends ThttpPlugin {

	protected runningRequests = 0
	protected totalRequests = 0
	protected totalRequestsInIterval = 0
	protected statInterval = 5000
	protected requestsPerSec = 0
	protected statTimer: Timer

	constructor(application: Application, config: any) {

		super(application, config);

		this.statTimer = new Timer({delay: this.statInterval});
		this.statTimer.on(Timer.ON_TIMER, this.onStatTimer.bind(this));
		this.statTimer.start()
	}

	public install() {
		super.install();

		this.app.use( bodyParser.json({
			limit: '500mb'
		}));
		this.app.post('/getSslCertificate', this.getSslCertificate.bind(this));
		this.app.post('/request', this.request.bind(this));
		this.app.post('/requests', this.requests.bind(this));
		this.app.get('/parseQueryString', this.parseQueryString.bind(this));

		this.app.get('/stats', this._stats.bind(this));
	}

	public onStatTimer() {
		this.requestsPerSec = utils.round( this.totalRequestsInIterval / (this.statInterval/1000), 1)
		this.totalRequestsInIterval = 0
		this.logger.debug('runningRequests : ' + this.runningRequests + ', requestsPerSec=' + this.requestsPerSec)
	}

	public parseQueryString(req: express.Request, res: express.Response, next: express.NextFunction) {
		let u = url.parse(req.url, false);
		res.json( qs.parse(u.query) );
	}

	public _stats(req: express.Request, res: express.Response, next: express.NextFunction) {
    	
    	this.getStats()
    	.then( (result: any) => {
    		res.json(result)		    		
    	})
    	.catch( (err: any) => {
    		next(err)
    	})

    }
    getStats(){

		let r: any = {	
			pid: process.pid,
			runningRequests: this.runningRequests,
			totalRequests: this.totalRequests,
			requestsPerSec: this.requestsPerSec		
		}		

		return Promise.resolve(r)
	}
	
	public getSslCertificate(req: express.Request, res: express.Response, next: express.NextFunction) {
		
		
		HttpTools.getSslCertificate(req.body)
		.then( (certificate: any) => {
		  	//console.log(certificate)
		  	// certificate is a JavaScript object

			//console.log(certificate.issuer)
			// { C: 'GB',
			//   ST: 'Greater Manchester',
			//   L: 'Salford',
			//   O: 'COMODO CA Limited',
			//   CN: 'COMODO RSA Domain Validation Secure Server CA' }

			//console.log(certificate.valid_from)
			// 'Aug  14 00:00:00 2017 GMT'

			//console.log(certificate.valid_to)
			// 'Nov 20 23:59:59 2019 GMT'

			// If there was a certificate.raw attribute, then you can access certificate.pemEncoded
			//console.log(certificate.pemEncoded)
			// -----BEGIN CERTIFICATE-----
			// ...
			// -----END CERTIFICATE-----

			res.json(certificate)
		})
		.catch((err: any) => {
			next(err)
		})
	}

	public requests(req: express.Request, res: express.Response, next: express.NextFunction) {

		try{
			
			if (typeof req.body.push !== 'function'){
				throw new Errors.BadRequest("body doit être de type array")
			} 
			
			for (var item of req.body){				
				if (item.pipeResponse)
					throw new Errors.BadRequest("pipeResponse n'est pas disponible sur /requests")
			}
			
			Promise.map(req.body, (item: any)=>{
				return 	this._request(item)
			},{ concurrency: 5})
			.then((results: any[]) => {
				res.status(200).json(results)
			})
		}catch(err){
			next(err)
		}
	}

	public request(req: express.Request, res: express.Response, next: express.NextFunction) {
		
		if (req.body.pipeResponse) {
            this.logger.info("HTTP(s) PIPED REQUEST : " + req.body.method + " " + req.body.url);
            //request(req.body).pipe(res);
            req.pipe( request(req.body) ).pipe(res)
        } else {
        	this._request(req.body)
        	.then((result) => {
        		res.status(200).json(result)
        	})
        	.catch(err=>{
        		next(err)
        	})
		}
	}

	_request(body: any){

		return new Promise( (resolve, reject) => {
			
			this.runningRequests ++
			this.totalRequests ++
			this.totalRequestsInIterval ++

			let startTime: number = new Date().getTime()

			let data: any[] = []
	    	let response: any
	    	if (!body.method)
	    		body.method = "GET";
	    	
	    	if (!body.headers)
				body.headers = {}

			body.headers['user-agent'] = 'mr-agent'

			request(body /*, (err: any, response: any, body: any) => {

					this.runningRequests --
					let xTime: number = new Date().getTime() - startTime;
					
					if (err){
						this.logger.error("HTTP(s) REQUEST : "+req.body.method+" "+req.body.url+' '+err.toString())
						let message = err.toString()
						err = JSON.parse(JSON.stringify(err))
						err.message = message
					} else {
						this.logger.info("HTTP(s) REQUEST : "+req.body.method+" "+req.body.url)
					}

					let r = {
	                    err: err,
	                    response: response,
	                    body: body,
	                    xTime: xTime,
	                    bodyIsBase64: false
	                };
	                
	                if (req.body.encodeBodyToBase64){
						r.body = Buffer.from(body).toString('base64')
						r.bodyIsBase64 = true
					}

					res.status(200).json(r)

			}*/)
			.on('data', function(chunk: Buffer) {
			 	data.push(chunk)
				})
			.on('response', function(resp) {
				response = resp
				
		    	//response.on('data', function(data) {
		      		//console.log('received ' + data.length + ' bytes of compressed data')
		    	//})
		  	})
		  	.on('error', (err) => {

		  		this.runningRequests --
		  		let xTime: number = new Date().getTime() - startTime;
				this.logger.error("HTTP(s) REQUEST : "+body.method+" "+body.url+' '+err.toString())

				let message = err.toString()
				err = JSON.parse(JSON.stringify(err))
				err.message = message

				let r: any = {
	                err: err,
	                xTime: xTime
	            };
	            resolve(r)
	            
			})
			.on('end', () => {
				
				this.logger.info("HTTP(s) REQUEST : "+body.method+" "+body.url)

				this.runningRequests --
				let xTime: number = new Date().getTime() - startTime;
				let dataBuffer = Buffer.concat(data)

				let r: any = {
	                response: response,
	                bodyIsBase64: true,
	                body: dataBuffer.toString('base64'),
	                xTime: xTime
	            };

	            resolve(r)
			});

			///.pipe( fs.createWriteStream('D:/tmp/out.crl'))

		})
	}

}


