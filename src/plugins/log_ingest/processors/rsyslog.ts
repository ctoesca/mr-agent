

import {TbaseProcessor} from '../TbaseProcessor'
import moment = require('moment')
import dns = require('dns');

export class Tprocessor extends TbaseProcessor {

	protected ipHash: Map<string, any> = new Map<string, any>()
	protected IPmask: RegExp = /([\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3})/g;
	
	protected levels: any = {
		'debug': 'DEBUG',
		'info': 'INFO',
		'notice': 'INFO',
		'warning': 'WARNING',
		'warn': 'WARNING',
		'error': 'ERROR',
		'err': 'ERROR',
		'crit': 'ERROR',
		'alert': 'ERROR',
		'emerg': 'ERROR'
	}

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
		// conversion niveaux

		/*
		Code  Gravité Mot-clé Description
		0 Emergency emerg (panic) Système inutilisable.
		1 Alert alert Une intervention immédiate est nécessaire.
		2 Critical  crit  Erreur critique pour le système.
		3 Error err (error) Erreur de fonctionnement.
		4 Warning warn (warning)  Avertissement (une erreur peut intervenir si aucune action n'est prise).
		5 Notice  notice  Événement normal méritant d'être signalé.
		6 Informational info  Pour information.
		7 Debugging debug Message de mise au point.
		*/



		constructor( name: string , opt: any) {

			super(name, opt);

			if (this.opt && this.opt.dnsServers) {
				dns.setServers( this.opt.dnsServers);
			}

		/*
		{
			"@timestamp":"2017-12-18T15:45:11+01:00",
			"@version":"1",
			"message":" %ASA-4-106023: Deny udp src lancristal:10.63.10.164/64837 dst inter_appli:172.27.20.193/53 by access-group \"global_access\" [0x0, 0x0]",
			"sysloghost":"172.27.8.4",
			"severity":"warning",
			"facility":"local5",
			"programname":"",
			"procid":"-"
		}
		*/

	}

	public createMessage( data: any ): any {
		let message = JSON.parse( data.message );
		return message;
	}

	public dnsReverse(ip: string) {
		if (!this.ipHash.has(ip)) {

			let ipData: any = {
				ip: ip,
				hostname: null
			}

			return new Promise((resolve) => {
				dns.reverse(ip, (err, hostnames) => {
					if (!err) {
						if (hostnames.length > 0) {
							ipData.hostname = hostnames[0]
						}
					}

					this.ipHash.set(ip, ipData);
					resolve(ipData);
				});
			});
		} else {
			return Promise.resolve(this.ipHash.get(ip));
		}
	}
	public getMessage( data: any ): Promise<any> {

		let message: any
		return super.getMessage(data)
		.then( (result: any) => {

			/*{
				"@timestamp":"2019-06-27T16:01:58+02:00",
				"@version":"1",
				"message":" Accepted password for deltat from 10.116.200.108 port 37818 ssh2",
				"sysloghost":"xprodeltmetme2",
				"syslogtag":"sshd[43088]:",
				"severity":"info",
				"facility":"authpriv",
				"programname":"sshd",
				"priority":"6",
				"procid":"43088"
			}*/

			message = result
			// message["@timestamp"] = moment(message["@timestamp"]).format("YYYY-MM-DDTHH:mm:ss.SSSZZ");

			/* level */
			message.original_level = message.severity

			if (this.levels[ message.severity]) {
				message.level = this.levels[ message.severity]
			}

			message.origin = message.sysloghost

			message.severity = undefined
			message['@version'] = undefined

			let iplist = message.message.match(this.IPmask)

			if (iplist !== null) {
				let promises = []
				let ipHash = {}
				for (let i = 0; i < iplist.length; i++) {
					let ip = iplist[i]
					if (!ipHash[ip]) {
						promises.push( this.dnsReverse(iplist[i]))
					}
					ipHash[ip] = ip
				}
				return Promise.all(promises);
			} else {
				return []
			}

		})
		.then( (results: any[]) => {
			message.hostnames = results	
			return message
		})
		
	}

	public getIndexName(message: any): any {
		return moment( message['@timestamp'] ).format('[rsyslog-]YYYY.MM.DD');
	}


}
