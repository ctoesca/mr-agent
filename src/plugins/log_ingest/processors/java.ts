


import {TbaseProcessor} from '../TbaseProcessor'
import moment = require('moment')

export class Tprocessor extends TbaseProcessor {

	protected levels: any = {
		'DEBUG': 'DEBUG',
		'ERROR': 'ERROR',
		'FATAL': 'ERROR',
		'INFO': 'INFO',
		'TRACE': 'DEBUG',
		'WARN': 'WARNING'
	}

	protected data1RegExp: RegExp = new RegExp(/[0-9]{4}\-[0-9]{2}\-[0-9]{2}\s[0-9]{2}\:[0-9]{2}\:[0-9]{2}/);

	constructor( name: string , opt: any) {

		super( name , opt);

	}

	public getMessage( data: any ) {

		/* Exemple de data:
		{
		"@timestamp":"2017-03-09T16:24:47.053Z",
		"beat":{
			"hostname":"HST_TOESCA",
			"name":"HST_TOESCA"
		},
		"count":1,
		"fields":{
			"env":"dev",
			"origin":"ctop.agent"
		},
		"input_type":"log",
		"message":"2017-08-10 12:13:25 INFO BLA BLA BLA",
		"offset":357389,
		"source":"/var/log/jboss/server.log",
		"type":"java"
		}
		*/

		/* Exemple LOG server.log
		2017-03-10 02:06:39,141 INFO  [org.jboss.web.WebService] (main) Using RMI server codebase: http://172.30.220.35:8283/

		logs applicatifs:
		2017/10/19 12:08:04,883 [TRACE] [123 : QueueReceptionMareva.java      ] : Un message a Ã©tÃ© aquittÃ© sur le connecteur mareva
		2017/10/19 12:08:05,004 [INFO ] [70  : QueueReceptionMareva.java      ] : File Delta-G: un message a Ã©tÃ© reÃ§u du connecteur mareva en 120 ms


		SANS LES MS:
		2017-11-06 14:56:52 INFO  [com.opensymphony.xwork2.interceptor.LoggingInterceptor.info - 42] Finishing execution stack for action //accueil-build

		*/


		return super.getMessage(data)
		.then( (message: any) => {


			let timestampStr = data.message.substr(0, 19)
			timestampStr = timestampStr.replace(/\//g, '-');

			if (timestampStr.match(this.data1RegExp)) {
				let timestamp = moment(timestampStr , 'YYYY-MM-DD HH:mm:ss').format();

				if (timestamp === 'Invalid date') {
					this.logger.debug('Tprocessor.java : invalid date (' + timestampStr + ") -> c'est une 'stacktrace' ?");
					message = false
				} else {
					message['@timestamp'] = timestamp
					let level

					let format = 1; // sans crochets
					let levelStart = 24
					let char19 = data.message.substr(19, 1)

					if (char19 === ' ') {
						// pas de ms
						levelStart = 20
					}

					if (data.message.substr(levelStart, 1) === '[') {
						format = 2
					}

					let parts = data.message.split(' ');


					if (format === 1) {
						// level sans crochets
						message.message = data.message.substr(levelStart + 6)
						level = parts[2]
					} else {
						// level avec crochets
						message.message = data.message.substr(levelStart + 8)
						level = parts[2].replace('[', '').replace(']', '')
					}

					if (this.levels[ level ]) {
						message.level = this.levels[ level ]
					} else {
						message.level = 'INFO'
						this.logger.debug("Tprocessor.java : le niveau '" + level + "' ne correspond pas à un niveau connu");
					}

				}

			} else {
				message = false
				this.logger.debug('Tprocessor.java : invalid date (' + timestampStr + ')');
			}

			return message;

		})

	}

	public getIndexName(message: any) {
		return moment( message['@timestamp'] ).format('[filebeat-]YYYY.MM.DD');
	}

}
