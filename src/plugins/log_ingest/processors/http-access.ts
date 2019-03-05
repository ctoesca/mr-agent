

import {TbaseParser} from '../parsers/TbaseParser'
import {TbaseProcessor} from '../TbaseProcessor'
import moment = require('moment')
import {HttpAccessParser} from '../parsers/HttpAccessParser.js'
import UAParser = require('ua-parser-js');


export class Tprocessor extends TbaseProcessor {

	constructor( name: string , opt: any) {

		super(name, opt);
		if (!this.opt) {
			this.opt = {}
		}

		if (!this.opt.formats) {
			this.opt.formats = {}
		}

		if (this.opt.remoteConfig) {
			this.loadRemoteConfig( this.opt.remoteConfig )
			.then( (result: any) => {
				this.logger.info('Succès récupétation de la configuration depuis ' + this.opt.remoteConfig.url)
				this.opt = result
				this.parseConfig()

			})
			.catch( (err: any) => {
				this.logger.error('Echec récupération de la configuration depuis ' + this.opt.remoteConfig.url + ': ', err)
				this.logger.warn('La configuration locale sera utilisée')

				this.parseConfig()
			})
		}

		// this.logParserApacheCid = new HttpAccessParser('$clientip $other $ident $auth [$timestamp] "$verb $request $httpversion" $response $bytes "$referrer" "$agent" $time_taken');
	}

	public parseConfig() {
		if (this.opt.formats) {
			Object.keys(this.opt.formats).forEach( (formatName) => {
				this.setParsers( this.opt.formats[formatName] )
			})

		} else {
			this.opt.formats = {}
			this.logger.warn('Aucun format dans la configuration du plugin log_ingest/' + this.name)
		}
	}

	public createParser( node: any ) {
		let parserClass = HttpAccessParser

		if (node.parserClass) {
			parserClass = require('../parsers/' + node.parserClass + '.js')[node.parserClass];
		}

		node.parser = new parserClass( node.masks );
	}

	public setParsers( node: any ) {
		if (node.selectors) {
			for (let i = 0; i < node.selectors.length; i++) {
				let selector = node.selectors[i]
				this.setParsers( selector )
			}
		} else if (node.masks) {
			this.createParser(node)
		}
	}

	public getParser( data: any ): TbaseParser {
		let r = null

		if (!this.opt.formats[ data.format ]) {
			throw new Error("format inconnu: '" + data.format + "'")
		}

		let node = this.opt.formats[ data.format ]

		if (node.parser) {
			r = node.parser
		} else if (node.selectors) {
			for (let i = 0; i < node.selectors.length; i++) {
				let selector = node.selectors[i]

				if (selector.fields) {
					Object.keys(selector.fields).forEach( (k) => {
						if (data[k] === selector.fields[k].match ) {
							if (selector.selectors) {
								return this.getParser( data )
							} else {
								return selector.parser
							}
						}
					})

				} else if (selector.parser) {
					return selector.parser
				}
			}
		}

		return r
	}

	public createMessage( data: any): any {
		data.message = data.message.replace(/\0/g, '')

		if (data.fields) {
			data.format = data.fields.format
		}

		let parser = this.getParser(data)
		let message: any = null

		if (parser) {
			data.message = data.message.replace(', ', ' ') // prosodie ajoute une virgule apres la 1ere IP............
			message = parser.parse(data.message);

			if (message === null) {
				throw 'Failed to parse data';
			}

		} else {
			throw new Error('Aucun parser pour le message : format=' + data.format + ', message=' + data.message)
		}
		return message

	}

	public getMessage( data: any ) {

		return super.getMessage(data)
		.then( (message: any) => {

			if (message.time_taken) {
				message['time-taken'] = parseInt(message.time_taken, 10);
				message.time_taken = undefined;
			}

			/* agent */
			if (message.agent) {
				message.useragent = new UAParser(message.agent).getResult();
				message.agent = undefined;
			}

			if (message.response < 400) {
				message.level = 'INFO';
			} else if (message.response < 500) {
				message.level = 'WARNING';
			} else {
				message.level = 'ERROR';
			}

			message.message = undefined
			message.source_message = data.message;

			return message;

		})



	}

	public getIndexName(message: any) {
		return moment( message['@timestamp'] ).format('[filebeat-]YYYY.MM.DD');
	}


}
