

import {TbaseProcessor} from '../TbaseProcessor'
import moment = require('moment')

export class Tprocessor extends TbaseProcessor {

	protected levels: any = {
		'Erreur' : 'ERROR',
		'Information' : 'INFO',
		'Avertissement' : 'WARNING',
		'Critique' : 'CRITICAL'
	}

	constructor( name: string , opt: any) {

		super(name, opt);

	}

	public createMessage( data: any ): any {
		return data;
	}

	public getMessage( data: any ): Promise<any> {

		return super.getMessage(data)
		.then( (message: any) => {

			message.original_level = message.level

			message.level = this.levels[message.level]

			if (!message.message) {
				message.level = 'WARNING'
				message.message = '<AUCUN MESSAGE>'
			}

			message.host = message.computer_name;
			message.origin = message.log_name;

			// message.beat = undefined;
			// message.computer_name = undefined;

			return message;

		})
	}

	public getIndexName(message: any) {
		return moment( message['@timestamp'] ).format('[winlogbeat-]YYYY.MM.DD');
	}

}
