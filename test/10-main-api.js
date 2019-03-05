const assert = require('assert');
//const request = require('request')
const request = require('request-promise')
const _ = require('lodash')
const expect = require('Chai').expect;

let confData

describe('main-api', function() 
{
	
	describe('GET /api/checkAgent', function() {

		it('should return 200', function (done) {

			request( getHttpOptions('GET', '/api/checkAgent') )
			.then( (res) => {			
				expect(res.statusCode).to.equal(200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(res.body.status, 0);
				assert.strictEqual(typeof res.body.version, 'string');
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});
	

	describe('GET /api/checkPort', function() {

		it('should return 200', function (done) {

			request( getHttpOptions('GET', '/api/checkPort?port='+PORT+'&host='+HOST) )
			.then( (res) => {		

				expect(res.statusCode).to.equal(200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(res.body.result, true);
			
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

	describe('GET /api/admin/os/cpus', function() {

		it('should return 200', function (done) {

			request( getHttpOptions('GET', '/api/admin/os/cpus') )
			.then( (res) => {		

				expect(res.statusCode).to.equal(200);
				assert.strictEqual(typeof res.body, 'object')	
				assert.strictEqual(_.isArray(res.body), true, 'body is array')		
				assert.strictEqual(res.body.length > 0, true, 'result is empty')
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

	describe('POST /api/getConfig', function() {
		
		it('should return 200', function (done) {
			
			request( getHttpOptions('POST', '/api/getConfig') )
			.then( (res) => {		

				expect(res.statusCode).to.equal(200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(typeof res.body.data, 'string');
				confData = res.body.data
				done()
			})
			.catch( err => {
				done(err)
			})
		});
	});


	describe('POST /api/setConfig without data', function() {

		it('should return 400', function (done) {
			let updateOpt = getHttpOptions('POST', '/api/setConfig')				
			updateOpt.body = {}

			execRequestExpectError(updateOpt, done, 400)

		});

	})

	describe('POST /api/setConfig without data.getConfig()', function() {

		it('should return 400', function (done) {
			let updateOpt = getHttpOptions('POST', '/api/setConfig')				
			updateOpt.body = {
				data: '{}'
			}
			
			execRequestExpectError(updateOpt, done, 400)
		});

	})


	describe('POST /api/setConfig', function() {

		it('should return 200', function (done) {
			let updateOpt = getHttpOptions('POST', '/api/setConfig')				
			updateOpt.body = {
				data: confData
			}
			
			request( updateOpt )
			.then( (res) => {	
				
				expect(res.statusCode).to.equal(200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(typeof res.body.data, 'string');
				done()				
			})
			.catch( err => {
				done(err)
			})
		});

	})

});
