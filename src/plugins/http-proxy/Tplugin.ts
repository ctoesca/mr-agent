

/*import fs = require('fs')*/
import express = require('express')
const hoxy = require('hoxy')
import {TbasePlugin} from '../TbasePlugin'
import {WorkerApplication as Application}  from '../../WorkerApplication'

export class Tplugin extends TbasePlugin {

	constructor(application: Application, config: any) {
		super(application, config);
	}

	public install() {
		super.install();

		let proxy = hoxy.createServer({
			// slow:{
			// 	latency : 500
			// },
			// upstreamProxy: "10.90.23.19:8085",
			/*certAuthority: {
				key: fs.readFileSync(__dirname + '/root-ca.key.pem'),
				cert: fs.readFileSync(__dirname + '/root-ca.crt.pem')
			} ,*/
			// tls: {
				// 	key: fs.readFileSync(__dirname+'/my-server.key.pem'),
				// 	cert: fs.readFileSync(__dirname+'/my-server.crt.pem')
				// }
		})
		.listen(this.config.port);

		proxy.intercept('request', (req: express.Request, resp: express.Response, cycle: any) => {

			var m = req.method+" "+req.protocol+"//"+req.hostname+"/"+req.url;
			this.logger.info(m)
			//if (req.port)
			//	m += ":"+req.port
			//m += req.url

		});

	}


}


