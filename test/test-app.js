
const cluster = require('cluster')
const Mocha = require('mocha')
const fs = require('fs-extra')
const path = require('path')
const mrAgent = require('..')
const assert = require('assert');
const request = require('request-promise')
const portscanner = require('portscanner');

global.PORT= 3020
global.HOST= "127.0.0.1"
global.base = 'http://'+global.HOST+':'+global.PORT
global.SSH_HOST = '185.212.226.228'
global.SSH_HOST_PORT = 2222
global.SSH_HOST_USERNAME = 'root'
global.SSH_HOST_PASSWORD = 'JzE1wqSnM'
global.SSH_HOST_PASSPHRASE = 'toto'

var testDir = __dirname

process.on('uncaughtException', function(error) {
    console.log('uncaughtException', error)
});

getHttpOptions = function(method, url) {
	
	return {
		url: base+url,
		method: method,
		json: true,
		resolveWithFullResponse: true,
		simple: false
	}
}
assertHttpError = function(done, res, status) {
	//console.log(res.body)
	console.log("status: "+res.statusCode, 'errorMessage='+res.body.errorMessage)
	assert.strictEqual(res.statusCode, status, 'status is not '+status);
	assert.strictEqual(typeof res.body, 'object', 'body is not object');
	assert.strictEqual(typeof res.body.errorMessage, 'string', 'errorMessage is not string');
	assert.strictEqual(res.body.error, true, 'error is not true');
	if (done)
		done()
}
execRequestExpectError = function(opt, done, status) {
	return request( opt )
	.then( (res) => {	
		assertHttpError(done, res, status)		
		return res		
	})
	.catch( err => {

		console.log('!!!!!', err)
		if (done)
			done(err)
		else
			throw err
	})
}

var getLogger = function( opt ) {
	return {
		"fatal" : function(){},
		"error" :  function(){},
		"warn" :  function(){},
		"info" :  function(){},
		"debug" : function(){},
		"trace": function(){},
	}
}

var execTests = function(dir){
	
	return new Promise( (resolve, reject) => {

		var mocha = new Mocha({
		    //reporter: 'spec'
		    reporter: 'mochawesome',
		    reporterOptions: {
		      reportDir: dir+'/mocha-report'
		      //reportName: 'report',
		    }
		});

		fs.readdirSync(dir).filter(function(file) {
		    return (file.substr(-3) === '.js') && (file != 'test-app.js');

		}).forEach(function(file) {
			console.log("ADD FILE "+file)
		    mocha.addFile(
		        path.join(dir, file)
		    );
		});

		mocha.run(function(failures) {

		  	//var exitCode = failures ? 1 : 0;  // exit with non-zero status if there were failures	  	
			resolve(failures)
		});

	})

}





if (cluster.isMaster)
{
	console.log("************ MASTER CREATED **************")
	
	global.app = mrAgent.create( mrAgent.MasterApplication, { 
		port: PORT, 
		getLoggerFunction: getLogger, 
		numProcesses:  1,
		forkOnWorkerExit: false
	})
	
	global.app.start()
	.then( application => {
		application.on('worker-exit', (worker, code) => {
			
			execTests(__dirname+'/master')
			.then( failures => {
				console.log("------------------------------   MASTER failures="+failures+' --------------------------------')
				process.exit(code)	
			})

			
		})
	})
	.catch( (err) => {
		console.log(err)
		process.exit(1)
	})

	/*let timer = setInterval( () => {
		portscanner.checkPortStatus(PORT, HOST, (error, status) => {
			console.log("STATUS="+status)
			if (status === 'open') {
				clearInterval(timer)
				execTests()
			}
			
		})
	}, 1000)*/
	

} else 
{
	/* WORKER */
	//console.log("************ WORKER CREATED **************")

	var app = mrAgent.create( mrAgent.WorkerApplication, { port: PORT, getLoggerFunction: getLogger})
	
	app.start()
	.then( (application) => {
		execTests(__dirname+'/worker')
		.then( (failures) => {
			console.log("------------------------------   WORKER failures="+failures+' --------------------------------')
			process.exit(failures)
		})
		.catch( (err) => {
			console.log("WORKER EXITCODE=1", err)
			process.exit(1)
		})
	})

}







