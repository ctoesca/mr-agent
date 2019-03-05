const assert = require('assert');
//const request = require('request')
const request = require('request-promise')
const expect = require('Chai').expect;


describe('plugin-http', function() 
{
	
	describe('POST /_plugin/http/request', function() {

		it('should return 200', function (done) {
			let opt = getHttpOptions('POST', '/_plugin/http/request')
			opt.body = {
				url: 'http://'+HOST+':'+PORT+'/api/checkAgent',
				method: 'GET',
				json: true
			}
			request( opt )
			.then( (res) => {		
				//console.log(res.body)	
				expect(res.statusCode).to.equal(200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(typeof res.body.body, 'object');
				assert.strictEqual(res.body.body.status, 0);
				expect(res.body.status).to.equal(200);
				assert.strictEqual(typeof res.body.body.version, 'string');
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});
	

	
	describe('POST /_plugin/http/request to unkown host', function() {

		it('should return 200 - content is error', function (done) {
			let opt = getHttpOptions('POST', '/_plugin/http/request')
			opt.body = {
				url: 'http://'+HOST+'blablabla:'+PORT+'/api/checkAgent',
				method: 'GET',
				json: true
			}
			request( opt )
			.then( (res) => {		
				//console.log(res.body)	
				expect(res.statusCode).to.equal(200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(res.body.isError, true);
				assert.strictEqual(typeof res.body.error !== 'undefined', true);
				assert.strictEqual(res.body.status, null);
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});


	describe('POST /_plugin/http/request to unkown url', function() {

		it('should return 200 - content is error 404', function (done) {
			let opt = getHttpOptions('POST', '/_plugin/http/request')
			opt.body = {
				url: 'http://'+HOST+':'+PORT+'/api/checkAgentBLABLABLA',
				method: 'GET',
				json: true
			}
			request( opt )
			.then( (res) => {		
				//console.log(res.body)	
				expect(res.statusCode).to.equal(200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(res.body.isError, false);
				assert.strictEqual(res.body.error, null);
				assert.strictEqual(res.body.status, 404);
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

});
