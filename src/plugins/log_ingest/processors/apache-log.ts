

import {TbaseProcessor} from '../TbaseProcessor'
import moment = require('moment')

export class Tprocessor extends TbaseProcessor {


	/*
		levels:
			emerg	Urgences - le système est inutilisable.	"Child cannot open lock file. Exiting"
			alert	Des mesures doivent être prises immédiatement.	"getpwuid: couldn't determine user name from uid"
			crit	Conditions critiques.	"socket: Failed to get a socket, exiting child"
			error	Erreurs.	"Premature end of script headers"
			warn	Avertissements.	"child process 1234 did not exit, sending another SIGHUP"
			notice	Evènement important mais normal.	"httpd: caught SIGBUS, attempting to dump core in ..."
			info	Informations.	"Server seems busy, (you may need to increase StartServers, or Min/MaxSpareServers)..."
			debug	Messages de débogage.	"Opening config file ..."
			trace1	Messages de traces	"proxy: FTP: control connection complete"
			trace2	Messages de traces	"proxy: CONNECT: sending the CONNECT request to the remote proxy"
			trace3	Messages de traces	"openssl: Handshake: start"
			trace4	Messages de traces	"read from buffered SSL brigade, mode 0, 17 bytes"
			trace5	Messages de traces	"map lookup FAILED: map=rewritemap key=keyname"
			trace6	Messages de traces	"cache lookup FAILED, forcing new map lookup"
			trace7	Messages de traces, enregistrement d'une grande quantité de données	"| 0000: 02 23 44 30 13 40 ac 34 df 3d bf 9a 19 49 39 15 |"
			trace8
			*/
			protected levels: any = {
				'debug': 'DEBUG',
				'info': 'INFO',
				'notice': 'INFO',
				'warn': 'WARNING',
				'error': 'ERROR',
				'crit': 'ERROR',
				'alert': 'ERROR',
				'emerg': 'ERROR'
			}
			protected data1RegExp: RegExp = new RegExp(/[a-zA-Z]{3}\s[a-zA-Z]{3}\s[0-9]{2}\s[0-9]{2}\:[0-9]{2}\:[0-9]{2}\.[0-9]{6}\s[0-9]{4}/)

			constructor( name: string , opt: any) {

				super(name, opt);


		/*
		[Thu Sep 07 21:31:20.843487 2017] [mpm_winnt:notice] [pid 10432:tid 216] AH00364: Child: All worker threads have exited.

		ou

		[2017-09-16 14:53:13] main.WARNING: [E_ERROR] Maximum execution time of 30 seconds exceeded

		*/

	}

	public getMessage( data: any ): Promise<any> {

		return super.getMessage(data)
		.then( (message: any) => {

			let timestampStr = data.message.substr(0, 33).replace('[', '').replace(']', '')

			if (timestampStr.match(this.data1RegExp)) {

				let timestamp = moment(timestampStr , 'ddd MMM DD HH:mm:SS.SSSSSS YYYY').format();

				if (timestamp === 'Invalid date') {
					message = false
					this.logger.debug('Tprocessor.apache-log : invalid date (' + timestampStr + ') ?');
				} else {
					message['@timestamp'] = timestamp

					let level
					let levelStart = 34

					message.message = data.message.substr(levelStart).replace(/\\\\n/g, '\n')

					let parts = message.message.split(' ');

					level = parts[0].split(':')[1].replace(']', '')

					if (this.levels[ level ]) {
						message.level = this.levels[ level ]
					} else {
						message.level = 'INFO'
						this.logger.debug("Tprocessor.apache-log : le niveau '" + level + "' ne correspond pas à un niveau connu");
					}

				}

			} else {
				message = false
				this.logger.debug('Tprocessor.apache-log : invalid date (' + timestampStr + '): ne correspond pas au filtre regexp');
			}


			return message;

		})

	}

	public getIndexName(message: any) {
		return moment( message['@timestamp'] ).format('[filebeat-]YYYY.MM.DD');
	}


}
