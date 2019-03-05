
import EventEmitter = require('events');

import WebSocket = require('ws');
import bunyan = require('bunyan');
import {Application} from '../Application'
import * as Promise from 'bluebird'

export class TrpcClientProxy extends EventEmitter {

	protected connectTimer: NodeJS.Timeout = null
	protected ws: WebSocket = null
	protected modules: any = {}
	protected opt: any = null
	protected logger: bunyan = null

	constructor(opt: any) {

		super();


		this.opt = opt


		this.logger = Application.getLogger('TrpcClientProxy');

		process.on('message', (msg) => {
			this.onWebsocketMessage(msg)
		})
	}

	public registerModule( name: string, module: any ) {
		this.modules[name] = new module({
			rpcClient: this,
			name: name
		})
	}

	public getModuleMethod(path: string) {
		// path = test.test1

		let parts = path.split('.')
		if (parts.length < 2) {
			throw 'RPC Method is incomplete. Example method: module1.method1'
		} else {
			let moduleName = parts[0]
			if (typeof this.modules[moduleName] === 'undefined') {
				throw 'unknown RPC module: ' + moduleName + "'"
			} else {
				let module = this.modules[moduleName]
				return module.getModuleMethod( path.rightOf('.'))
			}
		}
	}

	public send(msg: any) {
		process.send({
			rpc: msg
		})
	}

	public onWebsocketMessage(message: any) {


		return new Promise( (resolve, reject) => {
			if (typeof message !== 'object') {
				reject('onWebsocketMessage: message is not a object')
			} else {
				if (!message.method || !message.type ) {
					reject("'plugin' or 'method' or 'type' property is missing")
				} else {
					if (message.type === 'rpc') {
						let method = this.getModuleMethod(message.method)
						if (method === null) {
							reject("unknown method '" + message.method + "'")
						} else {
							try {
								resolve(method(message.args))
							} catch (err) {
								reject(err.toString())
							}
						}
					} else {
						reject("unknown message type : '" + message.type + "'")
					}
				}
			}

		})
		.then( result => {
			this.logger.info('RPC RESULT = ', result)
			this.send( {
				status: 0,
				result: result,
				correlationId: message.correlationId
			})

		})
		.catch(err => {
			this.logger.error('WebsocketMessage: ', err)
			this.logger.error('WebsocketMessage message: ', message)
			this.send({
				status: 1,
				correlationId: message.correlationId,
				error: err.toString()
			})
		})
	}
}



