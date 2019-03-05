

import {TbaseProcessor} from '../TbaseProcessor'
import moment = require('moment')

export class Tprocessor extends TbaseProcessor {

	protected levels: any = {
		10: 'TRACE',
		20: 'DEBUG',
		30: 'INFO',
		40: 'WARNING',
		50: 'ERROR',
		60: 'CRITICAL'
	}

	constructor( name: string , opt: any) {
		super( name , opt);
	}

	public createMessage( data: any ): any {
		let message = JSON.parse( data.message );
		return message;
	}

	public getMessage( data: any ): Promise<any> {
		/*
		{"name":"wineventlog","hostname":"PC","pid":7480,"level":30,"msg":"Processor wineventlog created. ","time":"2016-07-05T22:11:47.203Z","v":0}
		*/

		return super.getMessage(data)
		.then( (message: any) => {

			message.host = message.hostname;
			message.hostname = undefined;
			message.level = this.levels[message.level];
			message.message = '[' + message.name + '] ' + message.msg;
			message.source_name = message.name
			message.msg = undefined;
			message['@timestamp'] = moment(message.time).format('YYYY-MM-DDTHH:mm:ss.SSSZZ');
			message.logger = message.name;

			message.name = undefined;
			message.time = undefined;
			message.v = undefined;

			return message;
		})


	}

	public getIndexName(message: any) {
		return moment( message['@timestamp'] ).format('[filebeat-]YYYY.MM.DD');
	}

}
