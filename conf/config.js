
module.exports.getConfig = function () {
	 
	var conf = {
				
		 //Nombre de processus à lancer
		 "numProcesses": "auto",
		 
		 "allowedIp": "(172.27.36.150|172.27.36.77|127.0.0.1)",

		//Script exécuté au démarrage (utile sur windows pour monter des partages réseau)
		"startScript": `
			echo ok
		`,

		/*"logs":{ 
			"logger":{
				"level": "info",
				"streams": [ 
						{
							"stream": process.stdout
						}
						,{
							"type": "logrotator",
							"path": __dirname+"/../logs/log.json",
							"schedule": '1m', 
							"size": '50m', 
							"compress": false, 
							"count": 30
						}
					]       
			}
		},*/
		
		//Options HTTP
		"https": {

			"enabled": true/*,
			"pathOpenSSL": "...",
			"credentials":{
				key: '.........',
  				cert: '...........'
			}
			*/
		},

		// port d'écoute
		"port": 3000, 


		"plugins": {
			"ssh":{
				"enabled": true,
			},
			"filesystem":{
				"enabled": true,
			},
			"http":{
				"enabled": true,
			},
			"metrics": {
				"enabled": true
			},
			"http-proxy": {
				"enabled": false,
				"port": 9001
			},
			"dns": {
				"enabled": true,
				"dnsServers": [ "172.27.10.123", "10.121.191.1"]
			}
		}
	}
	return conf; 
};