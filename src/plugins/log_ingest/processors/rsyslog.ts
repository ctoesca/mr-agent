

import {TbaseProcessor} from '../TbaseProcessor'
import moment = require('moment')
import dns = require('dns');

export class Tprocessor extends TbaseProcessor {

	protected ipHash: Map<string, any> = new Map<string, any>()
	protected IPmask: RegExp = /([\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3})/g;
	protected deniedMask: RegExp = /(Deny|denied)/g;
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
		message.dst_port = null;
		message.src_ip = null;
		message.src_hostname = null;
		message.dst_ip = null;
		message.dst_hostname = null;

		return message;
	}

	public dnsReverse(ip: string) {
		if (this.ipHash.has(ip)) {
			this.ipHash.set(ip, {
				ip: ip,
				hostname: null
			})

			return new Promise( (resolve: Function) => {
				dns.reverse(ip, (err: any, hostnames: string[]) => {
					if (!err) {
						// [ 'par21s05-in-f131.1e100.net', 'par21s05-in-f3.1e100.net' ]
						if (hostnames.length > 0) {
							this.ipHash[ip].hostname = hostnames[0]
						}
					}

					resolve(this.ipHash[ip])

				})

			})
		} else {
			return Promise.resolve(this.ipHash[ip]);
		}
	}
	public getMessage( data: any ): Promise<any> {

		let message: any
		return super.getMessage(data)
		.then( (result: any) => {
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

			message.hostnames = []

			for (let i = 0; i < results.length; i++) {
				let host = results[i]

				message.hostnames.push( host )
				// message.message = message.message.replace( new RegExp(host.ip, 'g'), host.ip+"("+host.hostname+")" )

			}
			return message
		})

		.then( (result: any) => {

			let isDenied = result.message.match(this.deniedMask)
			let hasSourcesDest = (isDenied !== null);

			if (isDenied && (result.level === 'INFO')) {
				// certains messages de rejet sont en INFO *: on remplace par WARNING
				result.level = 'WARNING';
			}

			/* champs src_ip, dst_ip, src_hostname, dst_hostname */

			// %ASA-4-106023: Deny tcp src ZC01FE:172.30.160.33/39589 dst lancristal:172.26.10.78/1556 by access-group "ZC01FE_access_in" [0x0, 0x0]
			if (result.hostnames.length === 2) {
				/* on a un message qui contient 2 IP: ces ip sont peut-etre des IP source/Destination */

				if (!hasSourcesDest) {
					// srcip=10.145.21.113, dstip=172.27.10.123,dstport=53
					hasSourcesDest = result.message.match(/srcip=[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}.*dstip=[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}/)
				}

				if (hasSourcesDest) {
					result.src_ip = result.hostnames[0].ip
					result.src_hostname = result.hostnames[0].hostname

					result.dst_ip = result.hostnames[1].ip
					result.dst_hostname = result.hostnames[1].hostname


					let dst_port = result.message.match(/dstport=([\d]*)/);

					if (dst_port) {
						result.dst_port = dst_port[1]
					} else {
						dst_port = result.message.match(new RegExp(result.dst_ip + '.([\\d]+)'));
						if (dst_port) {
							result.dst_port = dst_port[1]
						}
					}


				}
			}

			result.hostnames = undefined

			return result
		})
	}

	public getIndexName(message: any) {
		return moment( message['@timestamp'] ).format('[rsyslog-]YYYY.MM.DD');
	}


}
