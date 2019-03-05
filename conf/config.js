
module.exports.getConfig = function () {
	
	var cmdb_api_username = "mr-agent"
	var cmdb_api_password = "s3#cr3ts"
	var url_ctop = "http://127.0.0.1:82"
 
	var conf = {
		"update": {
			"url": "https://github.com/ctoesca/mr-agent/blob/master/last_release/mr-agent.zip"
		},
		
		 //Nombre de processus à lancer
		 "numProcesses": 1,
		 

		//Script exécuté au démarrage (utile sur windows pour monter des partages réseau)
		/*"startScript": `
			echo ok
			`,*/

		//!!Attention: si allowedIp=null et auth=null, l'API ne sera pas accessible.
		//Adresses IP autorisées à se connecter au format "RegExp" ou null pour ne pas verifier les IP
		//null: la vérification ne se fait pas sur l'IP: C'EST DIFFERENT de '.*' !! 
		//"allowedIp": ".*",

		/*"auth": null (par défaut): la vérification ne se fait pas avec Basic Auth
		SINON:*/
		/*"auth":{
			"username" : "admin",
			"password" : "s3#cr3t",
		},*/

		//répertoire temporaire
		//"tmpDir": __dirname+"/../tmp",

		//Répertoire des données
		//"dataDir": __dirname+"/../data",
		
		//Répertoire des clefs privées SSH
		//"sshKeysDir": __dirname+"/sshKeys",


		//Options HTTP
		"https": {

			"enabled": false,
			//Si non défini (ou null), la clef et le certificat sont générés automatiquement avec openSsl.
			"credentials" : {
				//key: require("fs").readFileSync(__dirname+"/key.txt", 'utf8'),
				//cert: require("fs").readFileSync(__dirname+"/cert.pem", 'utf8')
				key: "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAvSsh7RbEnjssy3quk2yvsYxQd9d4ujMKe5meaOxcaHJfbZEJHbaB0M4idC1A/kvUH2fEIhUncxSSEAAH7XJXvrkO6EQ2lN9bY4CzsLVf+ilx+6+20i0icL+/M76xQFaAElB4HY5xDEMH6yIUCGrTZykBqd04JRsFUYum9v6+n9Jzsr7YnbKyw1KbCCVwz7YR6VbzBvRZAizdTWP5jc+o8o0RQqFlZ03cEemD4OY8+tbZRbXAdCnxOYpf9CjyBvEbFa+LBwL1++3rQbgEq0GClX1P8Fv625Wk9BHPzSN/C2wwa4H6E2KVOwmzrY6Elxy22m72mefbCQdjDGfbPcOqOQIDAQABAoIBAQCZbbl3leblO7OqWhfsRNP/moHNobsusqVG+KLuEP8mS9WwhVkye0uxMu/o8KdtWc1zp3MB/cxgX4fUaGIFqZ8XdvtrUaA/gSWbf9C+e22b9i+X5r3OnIL5ldwbuQgE2ePIdvHlbxmry1ZJ1PsQlKxgWHcb8exO1CqtKCrE3Ht6Hg9ES3aYnG2Nl0Bf1S0APUTj1KrdgrqtcgV+dIztYzlz5JOcD14it79nPBMdKtkOnQQHbLvv1azQnRbSPsyIJBjAF5GK7thyf8yjuDsK7F4VAIjnlQeUQSpE2DtfHfcukuCrl0P4/yOJHCK5gkN2cjgd3+MAD4dm2tj9i3o/QkUBAoGBAONkubSRE8s6aV0YkNtDIfMMhq5adPl8dxe+q41/va9OF76XHFR3e36EUAkqzWaSqnOKXXB2oXWke71BWhck4tj8DUMx+3waORDkuqJpzOzRcA94GmTLHvSDKMrbUQ0d0xrkHd7jU5Y88mSa33OR5n4IkzNIrk94BumtjGwPIBWhAoGBANT3XEPA28UCEOIqIwL5TQPVh2buDmpS8KxGhZ/y4yxMMYO7wAsQyKGq2G3QCCw30cPNeo7bZz0mU2XUuFTHZn1gNl4vozP28bzMq8kkMNd4W+FHZarr5qgDSJ4w/QrCf5YixzMbqW53ArOZ6lB4F4Q+ix9qd996+MdZ2xVvc52ZAoGAZd0DS54JzepWtLuCeJZ0KNqdopEnAXP+LYbedr6YjGVhQaGTsUrs6VoAOHsSFDbzYFrFTNH3til+vOL/poqBjE4s6sMDMy7UDXtJF+RpRlTz7BoTSL+tGD+BEI56mnOX094Ie4Y+NXkL5IF0Q+NB64eP2VNfsn3EKv3xf56u8sECgYAUGGM0YXZbWJ6POLqlBTEnM3bbV4s0rS7Ykq75MMoO3AGwFH9CjAridmSFuCONSJcaisENydYsBvnHmhLqrQYWvoVizcvwk1SsJAPxruCM9GZ3E22cezYAlI69npHB+ihf2lhBklKigchXeiaKAUr2x5AJHtrA07G13dy2YRXfwQKBgDzJQ/+Y2LvSOAEgInr/1+pROjxWi/8gTYsPRs6GjYMuJkLMtEJZEtT4eLx36wXa7tOLwBvnYrS+CRDqDyCAuGOL8XDMVYbMYZqJGlYi0aJaZ8Y/+PGF8r6Ec1fRwJ65p2jBYNpVJz7pFuKL1tYcqNDXL6jM1OszL9vPmDYDPKsE\n-----END RSA PRIVATE KEY-----",
				cert: "-----BEGIN CERTIFICATE-----\nMIICpDCCAYwCCQCF6g9pAQ9CszANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDEwlsb2NhbGhvc3QwHhcNMTcxMTA4MjIzMDU5WhcNMzEwNzE4MjIzMDU5WjAUMRIwEAYDVQQDEwlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC9KyHtFsSeOyzLeq6TbK+xjFB313i6Mwp7mZ5o7Fxocl9tkQkdtoHQziJ0LUD+S9QfZ8QiFSdzFJIQAAftcle+uQ7oRDaU31tjgLOwtV/6KXH7r7bSLSJwv78zvrFAVoASUHgdjnEMQwfrIhQIatNnKQGp3TglGwVRi6b2/r6f0nOyvtidsrLDUpsIJXDPthHpVvMG9FkCLN1NY/mNz6jyjRFCoWVnTdwR6YPg5jz61tlFtcB0KfE5il/0KPIG8RsVr4sHAvX77etBuASrQYKVfU/wW/rblaT0Ec/NI38LbDBrgfoTYpU7CbOtjoSXHLbabvaZ59sJB2MMZ9s9w6o5AgMBAAEwDQYJKoZIhvcNAQELBQADggEBAGAQ5y8ZztoJxi/8L9l8csnanQ8UGe4Mo782LiNUYsugmz+HNbBeQE+EwaPj8cr60rk4l86A9Kwcy4pvGecTvbsHnuJCJi+qqu913XGOVPkmblYHOeNyKRUg/evCQLG9t379ccz6qGD3kRE1mGDURroUmvKJ6CjAcJht5m+3sSk3exELZ9GuE7Yd9y12/rAx/oDGhMCm7dlmxhiqMk8gwwUfp+H2a9TbhfgdMyJF+X8A7DbZichnjqrg9SyLPh4wB2zKgMNfZIJ47QAyUIajLojlQ86TmpgMJWscDBGWvtaRbeDWgZjvo6aLDlagUh/0ei2i4P5ZqxLvC/+PO0nowM8=\n-----END CERTIFICATE-----"
			}
			//si non défini, openssl doit être dans le PATH de la machine.
			//"pathOpenSSL": null,

			//days is the certificate expire time in days
			//"days": 365, 

			//"selfSigned": true
		},

		//Temps d'exécution max d'une requête Http en MS sur l'API de l'agent. Tenir compte du fait que l'exécution d'un script Shell en ssh peut durer longtemps.
		//pas de timeout: mettre 0
		//"requestTimeout": 0,

		// port d'écoute
		"port": 3000, 


		/*"logs":
		{ 
			"http-access-log":{
				"enabled": true,
				"log-name": "access.log",
				"log-dir": __dirname+"/../logs",
				"options":{
					"size" : "10M",
					"maxFiles" : 7       
				}
			},
			"logger":{			
				"level": "info",
				"streams": [ 
					{
					  "stream": process.stdout
					},
					{
					  "type": "rotating-file",
					  "period": "1d",
					  "count": 7,
					  "level": "info", 
					  "path": __dirname+"/../logs/log.json"
					}
				]				
			}
		},*/

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
			"beats":{
				"enabled": true,
				"index": "metricbeat",
				"elasticsearch": {
					"hosts": ["localhost:9500"],
					"log": "info",
					"apiVersion": "6.3"
				}
			},
			"http-proxy": {
				"enabled": false,
				"port": 9001
			},
			"dns": {
				"enabled": true,
				"dnsServers":[
				],
			},
			"log_ingest": {
				"enabled": false,

				/*"loadbalance": [
					"local",
					"http://localhost:3001/_plugin/log_ingest/_bulk"
					],*/

					"elasticsearch": {
						"hosts": ["localhost:9200"],
						"log": "info",
						"apiVersion": "6.1"
					}, 

					/* facultatif: */
					"processors":{
						"http-access": 
						{
							"remoteConfig":{
								"url": url_ctop+"/apis/cmdb/1.0/configurations/getConfig?key=ctop.agent.plugin.log_ingest.processors.http-access&categorie=ctop.agent&singleResult=true",
								"auth":{
									"user" : cmdb_api_username,
									"pass" : cmdb_api_password
								}
							}
						}
					}

				}
			}
		};  

		return conf; 
	};