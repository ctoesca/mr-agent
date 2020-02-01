const assert = require('assert');
//const request = require('request')
const request = require('request-promise')
const simpleRequest = require('request')
const fs = require('fs-extra');
const expect = require('Chai').expect;
const _ = require('lodash')


var tmpDir = __dirname+"/../../tmp"
var sourceDir = __dirname+"/../../dist"
var sourceFile = __dirname+"/../../dist/index.js"
var sourceFileName = "index.js"

function checkSshError(res, errorClass, connected= null, level = null){
	/*
	{
		"error": true,
		"errorMessage": "Error: Cannot parse privateKey: PPK private key integrity check failed -- bad passphrase?",
		"code": 500,
		"errorNum": 1,
		"errorClass": "SshError",
		"stack": "Error: Cannot parse privateKey: PPK private key integrity check failed -- bad passphrase?\n at Promise.any.catch (G:\\dev\\nexilearn\\mr-agent\\dist\\plugins\\ssh\\SshConnection.js:69:28)\n at tryCatcher (G:\\dev\\nexilearn\\mr-agent\\node_modules\\bluebird\\js\\release\\util.js:16:23)\n at Promise._settlePromiseFromHandler (G:\\dev\\nexilearn\\mr-agent\\node_modules\\bluebird\\js\\release\\promise.js:512:31)\n at Promise._settlePromise (G:\\dev\\nexilearn\\mr-agent\\node_modules\\bluebird\\js\\release\\promise.js:569:18)\n at Promise._settlePromise0 (G:\\dev\\nexilearn\\mr-agent\\node_modules\\bluebird\\js\\release\\promise.js:614:10)\n at Promise._settlePromises (G:\\dev\\nexilearn\\mr-agent\\node_modules\\bluebird\\js\\release\\promise.js:690:18)\n at _drainQueueStep (G:\\dev\\nexilearn\\mr-agent\\node_modules\\bluebird\\js\\release\\async.js:138:12)\n at _drainQueue (G:\\dev\\nexilearn\\mr-agent\\node_modules\\bluebird\\js\\release\\async.js:131:9)\n at Async._drainQueues (G:\\dev\\nexilearn\\mr-agent\\node_modules\\bluebird\\js\\release\\async.js:147:5)\n at Immediate.Async.drainQueues [as _onImmediate] (G:\\dev\\nexilearn\\mr-agent\\node_modules\\bluebird\\js\\release\\async.js:17:14)\n at runCallback (timers.js:705:18)\n at tryOnImmediate (timers.js:676:5)\n at processImmediate (timers.js:658:5)",
		"detail":{
			"connected": false,
			"level": "client-authentication"
		}
	}
	*/
	assert.strictEqual(typeof res.body, 'object', 'body is not object');
	assert.strictEqual(typeof res.body.detail, 'object', 'detail is not object');
	assert.strictEqual(res.body.errorClass, errorClass, 'error class != \''+errorClass+'\'');
	
	if (typeof connected !== 'undefined')
		assert.strictEqual(res.body.detail.connected, connected, 'detail.isConnected != '+connected);

	assert.strictEqual(typeof res.body.detail.level, 'string', 'detail.level is not string');
	if (level)
		assert.strictEqual(res.body.detail.level, level, 'detail.level != '+level);

}
function checkUploadResult(res, sourceFile, path){
	/* body = {
			host: string,
			files: [{
				name: string,
				path: string,
				size: number
			}]
		}*/
		assert.strictEqual(res.statusCode, 200);
		assert.strictEqual(typeof res.body, 'object', 'body is not object');
		assert.strictEqual(_.isArray(res.body.files), true, 'body.files is not array');
		assert.strictEqual(res.body.host, SSH_HOST, 'body.host != '+SSH_HOST);
		assert.strictEqual(res.body.files.length, 1, 'body.files length != 1');

		let file = res.body.files[0]
		assert.strictEqual(file.path, path, 'files[0].path != '+path);
		assert.strictEqual(file.size, fs.statSync(sourceFile).size, 'files[0].size is not number');
}

describe('GET /_plugin/ssh', function() {

		it('should return 404', function (done) {
			let opt = getHttpOptions('GET', '/_plugin/ssh')
			execRequestExpectError(opt, done, 404)
		});

});



describe('/_plugin/ssh/upload', function() {

	describe('upload file', function() {

		it('should return 200', function (done) {
		
			let path = '/tmp/upload.txt'
			let opt = getHttpOptions('POST', '/_plugin/ssh/upload?path='+path+'&port='+SSH_HOST_PORT+'&host='+SSH_HOST+'&username='+SSH_HOST_USERNAME+'&password='+SSH_HOST_PASSWORD)
			
			opt.formData = {
		        // Like <input type="text" name="name">
		        name: sourceFileName,
		        // Like <input type="file" name="file">
		        file1: {
		            value: fs.createReadStream(sourceFile),
		            options: {
		                filename: sourceFileName,
		                contentType: 'application/javascript'
		            }
		        },
		        file2: {
		            value: fs.createReadStream(sourceDir+'/Application.js'),
		            options: {
		                filename: 'Application.js',
		                contentType: 'application/javascript'
		            }
		        }
		    },
					
			request( opt )
			.then( (res) => {	
				checkUploadResult( res, sourceFile, path  )
				done();				
			})
			.catch( err => {
				done(err)
			})
		}).timeout(MOCHA_TIMEOUT)
	})


	describe('upload file in incorrect path', function() {

		it('should return 400', function (done) {
		
			let path = '/blablabla/upload.txt'
			let opt = getHttpOptions('POST', '/_plugin/ssh/upload?path='+path+'&port='+SSH_HOST_PORT+'&host='+SSH_HOST+'&username='+SSH_HOST_USERNAME+'&password='+SSH_HOST_PASSWORD)
			
			opt.formData = {
		        // Like <input type="text" name="name">
		        name: sourceFileName,
		        // Like <input type="file" name="file">
		        file1: {
		            value: fs.createReadStream(sourceFile),
		            options: {
		                filename: sourceFileName,
		                contentType: 'application/javascript'
		            }
		        }
		    }
					
			execRequestExpectError( opt, done, 400 )


		}).timeout(MOCHA_TIMEOUT)
	})
})
	/*describe('upload no file', function() {

		it('should return error', function (done) {
		
			let path = tmpDir+'/upload2.txt'
			if (fs.pathExistsSync(path))
				fs.unlinkSync(path)

			let opt = getHttpOptions('POST', '/_plugin/filesystem/upload?path='+path)
			
			opt.formData = {
		        name: sourceFileName,
		    },
					
			execRequestExpectError(opt, done, 400)
		}).timeout(MOCHA_TIMEOUT)
	})

	describe('upload file - dest is directory', function() {

		it('should return 400 (dest is a directory)', function (done) {
		
			let path = tmpDir

			let opt = getHttpOptions('POST', '/_plugin/filesystem/upload?path='+path)
			
			opt.formData = {
		        // Like <input type="text" name="name">
		        name: sourceFileName,
		        // Like <input type="file" name="file">
		        file: {
		            value: fs.createReadStream(sourceFile),
		            options: {
		                filename: sourceFileName,
		                contentType: 'application/javascript'
		            }
		        }
		    },
					
			execRequestExpectError(opt, done, 400)
		}).timeout(MOCHA_TIMEOUT)
	})

	describe('upload file - dest directory does not exist', function() {

		it('should return 400 (dest a directory does not exis)', function (done) {
		
			let path = tmpDir+'/uploadblablabla/upload.txt'

			let opt = getHttpOptions('POST', '/_plugin/filesystem/upload?path='+path)
			
			opt.formData = {
		        // Like <input type="text" name="name">
		        name: sourceFileName,
		        // Like <input type="file" name="file">
		        file: {
		            value: fs.createReadStream(sourceFile),
		            options: {
		                filename: sourceFileName,
		                contentType: 'application/javascript'
		            }
		        }
		    },
					
			execRequestExpectError(opt, done, 400)
		}).timeout(MOCHA_TIMEOUT)
	})


	describe('upload existing file - overwrite=false', function() {

		it('should return error', function (done) {
		
			let path = tmpDir+'/upload.txt'
			let opt = getHttpOptions('POST', '/_plugin/filesystem/upload?path='+path+'&overwrite=false')
			
			opt.formData = {
		        // Like <input type="text" name="name">
		        name: sourceFileName,
		        // Like <input type="file" name="file">
		        file: {
		            value: fs.createReadStream(sourceFile),
		            options: {
		                filename: sourceFileName,
		                contentType: 'application/javascript'
		            }
		        }
		    },
					
			execRequestExpectError(opt, done, 400)
		}).timeout(MOCHA_TIMEOUT)
	})*/









describe('/_plugin/ssh with password', function() {

	describe('exec script on unknown host', function() {
		this.timeout(25000);
		it('should return 500', function (done) {
		
	
			let opt = getHttpOptions('POST', '/_plugin/ssh/exec')
			
			opt.body = {
				script:  "ls -l",
				host: 'blablabla',
				port: SSH_HOST_PORT,
				username: SSH_HOST_USERNAME,
				password: SSH_HOST_PASSWORD
			}
		    
			execRequestExpectError(opt, null, 500)
			.then( res => {
				checkSshError(res, 'SshError', false, 'client-socket')
				done()
			})
			.catch( err => {
				done(err)
			})
		}).timeout(MOCHA_TIMEOUT)
	})

	describe('exec script with incorrect password', function() {

		this.timeout(25000);

		it('should return 500', function (done) {
		
			let opt = getHttpOptions('POST', '/_plugin/ssh/exec')
			
			opt.body = {
				script:  "ls -l",
				host: SSH_HOST,
				port: SSH_HOST_PORT,
				username: SSH_HOST_USERNAME,
				password: 'blablabla'
			}
		    
			execRequestExpectError(opt, null, 500)
			.then( res => {
				checkSshError(res, 'SshError', false, 'client-authentication')
				done()
			})
			.catch( err => {
				done(err)
			})
		}).timeout(MOCHA_TIMEOUT)
	})

	describe('exec script', function() {

		it('should return 200', function (done) {
		
			let opt = getHttpOptions('POST', '/_plugin/ssh/exec')
			
			opt.body = {
				script:  "echo $USER",
				host: SSH_HOST,
				port: SSH_HOST_PORT,
				username: SSH_HOST_USERNAME,
				password: SSH_HOST_PASSWORD
			}
		    
		    request( opt )
			.then( (res) => {	
				
				assert.strictEqual(res.statusCode, 200, 'status is not 200');
				assert.strictEqual(res.body.stdout.trim(), SSH_HOST_USERNAME, 'stdout != '+SSH_HOST_USERNAME);
				assert.strictEqual(res.body.stderr, '', 'stderr is not empty');
				assert.strictEqual(res.body.exitCode, 0, 'exitCode != 0');

				done();				
			})
			.catch( err => {
				done(err)
			})

			
		}).timeout(MOCHA_TIMEOUT)
	})



	describe('exec script with stderr and exitCode=1', function() {

		it('should return 200', function (done) {
		
			let opt = getHttpOptions('POST', '/_plugin/ssh/exec')
			
			opt.body = {
				script:  "cd /blablabla",
				host: SSH_HOST,
				port: SSH_HOST_PORT,
				username: SSH_HOST_USERNAME,
				password: SSH_HOST_PASSWORD
			}
		    
		    request( opt )
			.then( (res) => {	

				assert.strictEqual(res.statusCode, 200, 'status is not 200');
				assert.strictEqual(res.body.stderr.trim() !== '', true, 'stderr is empty');
				assert.strictEqual(res.body.exitCode, 1, 'exitCode != 0');

				done();				
			})
			.catch( err => {
				done(err)
			})

			
		}).timeout(MOCHA_TIMEOUT)
	})
})


describe('/_plugin/ssh sftpReaddir', function() {
	describe('sftpReaddir', function() {

		it('should return 200', function (done) {

			let params = 'path=/tmp&host='+SSH_HOST+'&username='+SSH_HOST_USERNAME+'&password='+SSH_HOST_PASSWORD+'&port='+SSH_HOST_PORT
			let opt = getHttpOptions('GET', '/_plugin/ssh/sftpReaddir?'+params)
			    
		    request( opt )
			.then( (res) => {	
				
				assert.strictEqual(res.statusCode, 200, 'status is not 200');
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(typeof res.body.result, 'object', 'result is not object');

				done();				
			})
			.catch( err => {
				done(err)
			})

			
		}).timeout(MOCHA_TIMEOUT)
	})

	describe('sftpReadir with no path', function() {

		it('should return 400', function (done) {

			let params = 'host='+SSH_HOST+'&username='+SSH_HOST_USERNAME+'&password='+SSH_HOST_PASSWORD+'&port='+SSH_HOST_PORT

			let opt = getHttpOptions('GET', '/_plugin/ssh/sftpReaddir?'+params)
			
		    execRequestExpectError(opt, done, 400)
		   
		}).timeout(MOCHA_TIMEOUT)
	})

	describe('sftpReadir with incorrect path', function() {

		it('should return 400', function (done) {

			let params = 'path=/dfgdfsgfdsgdsfg&host='+SSH_HOST+'&username='+SSH_HOST_USERNAME+'&password='+SSH_HOST_PASSWORD+'&port='+SSH_HOST_PORT

			let opt = getHttpOptions('GET', '/_plugin/ssh/sftpReaddir?'+params)
			
		    execRequestExpectError(opt, done, 400)
		   
		}).timeout(MOCHA_TIMEOUT)
	})
})


describe('/_plugin/ssh with remote key', function() {

	
	describe('exec script with incorrect passphrase', function() {

		this.timeout(25000);

		it('should return 500', function (done) {
		
			let opt = getHttpOptions('POST', '/_plugin/ssh/exec')
			
			opt.body = {
				script:  "ls -l",
				host: SSH_HOST,
				port: SSH_HOST_PORT,
				username: SSH_HOST_USERNAME,
				passphrase: 'blablabla'
			}
		    
			execRequestExpectError(opt, null, 500)
			.then( res => {
				checkSshError(res, 'SshError', false, 'client-authentication')
				done()
			})
			.catch( err => {
				done(err)
			})
		}).timeout(MOCHA_TIMEOUT)
	})

	describe('exec script', function() {

		it('should return 200', function (done) {
		
			let opt = getHttpOptions('POST', '/_plugin/ssh/exec')
			
			opt.body = {
				script:  "echo $USER",
				host: SSH_HOST,
				port: SSH_HOST_PORT,
				username: SSH_HOST_USERNAME,
				passphrase: SSH_HOST_PASSPHRASE
			}
	    

		    request( opt )
			.then( (res) => {	
			
				assert.strictEqual(res.statusCode, 200, 'status is not 200');
				assert.strictEqual(res.body.stdout.trim(), SSH_HOST_USERNAME, 'stdout != '+SSH_HOST_USERNAME);
				assert.strictEqual(res.body.stderr, '', 'stderr is not empty');
				assert.strictEqual(res.body.exitCode, 0, 'exitCode != 0');

				done();				
			})
			.catch( err => {
				done(err)
			})

			
		}).timeout(MOCHA_TIMEOUT)
	})



	describe('exec script with stderr and exitCode=1', function() {

		it('should return 200', function (done) {
		
			let opt = getHttpOptions('POST', '/_plugin/ssh/exec')
			
			opt.body = {
				script:  "cd /blablabla",
				host: SSH_HOST,
				port: SSH_HOST_PORT,
				username: SSH_HOST_USERNAME,
				passphrase: SSH_HOST_PASSPHRASE
			}
		    
		    request( opt )
			.then( (res) => {	
	
				assert.strictEqual(res.statusCode, 200, 'status is not 200');
				assert.strictEqual(res.body.stderr.trim() !== '', true, 'stderr is empty');
				assert.strictEqual(res.body.exitCode, 1, 'exitCode != 0');

				done();				
			})
			.catch( err => {
				done(err)
			})

			
		}).timeout(MOCHA_TIMEOUT)
	})
})













describe('/_plugin/ssh/download', function() {

	describe('download with password', function() {
		
		it('should return 200', function (done) {
			let params = 'path=/tmp/upload.txt&host='+SSH_HOST+'&username='+SSH_HOST_USERNAME+'&password='+SSH_HOST_PASSWORD+'&port='+SSH_HOST_PORT
			let opt = getHttpOptions('GET', '/_plugin/ssh/download?'+params)
			
			request( opt )
			.then( (res) => {	
				assert.strictEqual(res.statusCode, 200, 'status is not 200');
				assert.strictEqual(res.headers['content-disposition'], 'attachment; filename="upload.txt"', 'Content-Disposition is not attachment');
				done();				
			})
			.catch( err => {
				done(err)
			})

		}).timeout(MOCHA_TIMEOUT)
	})

	describe('download not existing file', function() {
		
		it('should return 400', function (done) {
			let params = 'path=/tmp/blablablaff.txt&host='+SSH_HOST+'&username='+SSH_HOST_USERNAME+'&password='+SSH_HOST_PASSWORD+'&port='+SSH_HOST_PORT
			let opt = getHttpOptions('GET', '/_plugin/ssh/download?'+params)
			
			execRequestExpectError(opt, done, 400)

		}).timeout(MOCHA_TIMEOUT)
	})


	describe('download directory', function() {
		
		it('should return 500', function (done) {
			let params = 'path=/tmp&host='+SSH_HOST+'&username='+SSH_HOST_USERNAME+'&password='+SSH_HOST_PASSWORD+'&port='+SSH_HOST_PORT
			let opt = getHttpOptions('GET', '/_plugin/ssh/download?'+params)
			
			execRequestExpectError(opt, done, 500)

		}).timeout(MOCHA_TIMEOUT)
	})
})