

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
		protected data1RegExp = new RegExp(/[0-9]{4}\/[0-9]{2}\/[0-9]{2}\s[0-9]{2}\:[0-9]{2}\:[0-9]{2}/)


		constructor( name: string , opt: any) {

			super(name, opt);

		/*
		2017/11/16 01:34:16 [error] 12968#13008: *10904 WSARecv() failed (10054: FormatMessage() error:(15105)) while reading response header from upstream,
		client: 127.0.0.1, server: , request: "POST /log_ingest/_bulk HTTP/1.1", upstream: "http://127.0.0.1:3000/_plugin/log_ingest/_bulk", host: "localhost:82"

		2017/11/16 02:03:12 [warn] 8452#8840: *3 a client request body is buffered to a temporary file D:\nexilearn\production\apache\htdocs\dev\bin\nginx-1.13.3/temp/client_body_temp/0000000001,
		client: 127.0.0.1, server: , request: "POST /log_ingest/_bulk HTTP/1.1", host: "localhost:82"

		*/
	}

	public getMessage( data: any  ) {

		return super.getMessage(data)
		.then( (message: any ) => {

			let timestampStr = data.message.substr(0, 19)

			if (timestampStr.match(this.data1RegExp)) {
				let timestamp = moment(timestampStr , 'YYYY/MM/DD HH:mm:ss').format();

				if (timestamp === 'Invalid date') {
					message = false;
					this.logger.debug('Tprocessor.nginx-log : invalid date (' + timestampStr + ") -> c'est une 'stacktrace' ?");
				} else {
					message['@timestamp'] = timestamp
					let level
					let levelStart = 20

					let parts = data.message.split(' ');
					level = parts[2].replace('[', '').replace(']', '')

					message.message = data.message.substr(levelStart + level.length + 3)

					if (this.levels[ level ]) {
						message.level = this.levels[ level ]
					} else {
						message.level = 'INFO'
						this.logger.debug("Tprocessor.nginx-log : le niveau '" + level + "' ne correspond pas à un niveau connu");
					}
				}

			} else {
				message = false
				this.logger.debug('Tprocessor.nginx-log : invalid date (' + timestampStr + '): ne correspond pas au filtre regexp');
			}


			return message;

		})
	}

	public getIndexName(message: any ) {
		return moment( message['@timestamp'] ).format('[filebeat-]YYYY.MM.DD');
	}


}
