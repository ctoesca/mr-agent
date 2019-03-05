const assert = require('assert');
//const request = require('request')
const request = require('request-promise')
const _ = require('lodash')
const expect = require('Chai').expect;

describe('plugin-dns', function() 
{
	
	describe('GET /_plugin/dns/dnsReverse', function() {

		it('should return 200', function (done) {

			request( getHttpOptions('GET', '/_plugin/dns/dnsReverse?ip=127.0.0.1') )
			.then( (res) => {		
				console.log(res.body)
				expect(res.statusCode).to.equal(200);
				assert.strictEqual(typeof res.body, 'object')	
				assert.strictEqual(res.body.ip, '127.0.0.1')	
				assert.strictEqual(_.isArray(res.body.hostnames), true, 'hostnames is not array')						
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

	describe('GET /_plugin/dns/dnsReverse (user cache)', function() {

		it('should return 200', function (done) {

			request( getHttpOptions('GET', '/_plugin/dns/dnsReverse?ip=127.0.0.1') )
			.then( (res) => {		
				console.log(res.body)
				expect(res.statusCode).to.equal(200);
				assert.strictEqual(typeof res.body, 'object')	
				assert.strictEqual(res.body.ip, '127.0.0.1')	
				assert.strictEqual(_.isArray(res.body.hostnames), true, 'hostnames is not array')						
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

});
