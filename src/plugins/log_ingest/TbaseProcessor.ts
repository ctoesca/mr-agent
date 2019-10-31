
import {Application} from '../../Application'
import EventEmitter = require('events');
import request = require('request');
import bunyan = require('bunyan');
import moment = require('moment')

export class TbaseProcessor extends EventEmitter {
	public name: string = null
	public opt: any = null
	public logger: bunyan = null

	constructor( name: string , opt: any) {

		super();

		this.name = name;
		this.opt = opt;
		this.logger = Application.getLogger(this.name);
		this.logger.info('Processor ' + name + ' created. ');
	}

	// SYNC
	public createMessage( data: any): any {

		let message: any = {}
		return message;
	}

	public loadRemoteConfig( data: any ) {
		return new Promise((resolve, reject) => {
			let options: any = {
				url: data.url,
				strictSSL: false,
				json: true,
				method: 'GET',
				headers: {
					'user-agent': 'mr-agent'
				}
			}
			if (data.auth) {
				options.auth = data.auth
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
						resolve(body)
					}
				}
				)
		})
	}

	// SYNC
	public setCommonProperties(data: any, message: any) {

		if (data.fields) {
			/* origin */
			/* env */
			/* etc ... */
			Object.keys(data.fields).forEach( (k) => {
				message[k] = data.fields[k];
			})

		} else {
			/* origin */
			if (data.origin) {
				message.origin = data.origin;
			}

			/* env */
			if (data.env) {
				message.env = data.env;
			}
		}

		/* type */
		message.type = data.type;

		/* host */
		if (data.host) {
			message.host = data.host;
		} else {
			if (data.beat) {
				message.host = data.beat.hostname;
			}
		}

		if (data.source) {
			message.source = data.source;
		}

		if (!message['@timestamp'])
			message['@timestamp'] = data['@timestamp']

		if (data.indexPrefix)
			message._indexName = moment( message['@timestamp'] ).format('['+data.indexPrefix+'-]YYYY.MM.DD');
		else
			message._indexName = this.getIndexName( message )

		message.indexPrefix = undefined
		message.beat = undefined;
		return message
	}

	// ASYNC
	public getMessage( data: any ): Promise<any> {
		try {
			let message = this.createMessage( data )
			this.setCommonProperties( data, message )

			return Promise.resolve(message)
		} catch (err) {
			return Promise.reject(err)
		}
	}

	public getIndexName(message: any) {
		throw 'getIndexName is not implemented';
	}

}
