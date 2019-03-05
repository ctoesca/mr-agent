
import EventEmitter = require('events');
import {Application} from '../Application'
import WebSocket = require('ws');
import * as Promise from 'bluebird'
import os = require('os')
import bunyan = require('bunyan')

export class TrpcClient extends EventEmitter {

	protected connectTimer: NodeJS.Timeout = null
	protected ws: WebSocket = null
	protected modules: any = {}
	protected opt: any = null
	protected logger: bunyan = null

	constructor(opt: any) {

		super();

		this.opt = opt
		this.logger = Application.getLogger('TrpcClient');
	}

	public connect() {
		return new Promise( (resolve, reject) => {
			let ws = new WebSocket(this.opt.url);
			ws.on('open', () => {
				this.ws = ws
				this.emit( 'connected')

				ws.on('close', (code: number, message: string) => {
					this.ws = null
					this.logger.error('WEBSOCKET CLOSED code=' + code + ', message=' + message);
					this.emit( 'disconnected')
				});

				resolve(ws)

				this.auth()
			});
			ws.on('error', ( err: any ) => {
				this.ws = null
				reject(err)
			});

		})
	}
	public auth() {
		let msg: any = {
			rpc: {
				args: {
					hostname: os.hostname()
				}
			}
		}
		this.send(msg)
	}
	public init(args: any) {
		this.logger.info(args)
		this.connectTimer = setInterval( () => {
			if (this.ws === null) {
				this.connect()
				.then( ( ws: WebSocket ) => {

					this.logger.error('CONNECTED TO WEBSOCKET SERVER');
					ws.on('message', this.onWebsocketMessage.bind(this));

				})
				.catch(err => {
					this.logger.error('WEBSOCKET CONNECT ERROR ', err);
				})
			}
		}, 5000)

	}

	public send(msg: any) {
		this.ws.send( JSON.stringify(msg))
	}

	public onWebsocketMessage(message: string) {
		let messageObject: any = null
		try {
			try {
				messageObject = JSON.parse(message)
			} catch (err) {

				throw 'malformed message (not JSON): ' + err.toString()
			}

			if (!messageObject.method || !messageObject.type ) {
				throw "'plugin' or 'method' or 'type' property is missing"
			} else if (messageObject.type === 'rpc') {
				this.emit('rpc-message', messageObject)
			} else {
				throw "unknown message type : '" + messageObject.type + "'"
			}
		} catch (err) {
			this.logger.error(messageObject)
			this.logger.error('onWebsocketMessage :' + err.toString())
		}


	}
}



