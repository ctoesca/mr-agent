

import {TbaseProcessor} from '../TbaseProcessor'
import moment = require('moment')
import UAParser = require('ua-parser-js');

export class Tprocessor extends TbaseProcessor {

	constructor( name: string , opt: any) {

		super( name , opt);

	}

	public createMessage( data: any ) {
		let message = JSON.parse( data.message );
		return message;
	}



	public getMessage( data: any ): any {

		return super.getMessage(data)
		.then( (message: any) => {

			/* agent */
			if (message.agent) {
				message.useragent = new UAParser(message.agent).getResult();
				message.agent = undefined;
			}

			// Pas utile: déjà au format "locale", avec microsecondes
			// message["@timestamp"] = moment(message.time).format("YYYY-MM-DDTHH:mm:ss.SSSZZ");

			if (message.response >= 400) {
				message.level = 'WARNING';
			}
			if (message.response >= 500) {
				message.level = 'ERROR';
			}
			return message
		})



	}

	public getIndexName(message: any) {
		return moment( message['@timestamp'] ).format('[filebeat-]YYYY.MM.DD');
	}

}
