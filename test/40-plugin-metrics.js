const assert = require('assert');
//const request = require('request')
const request = require('request-promise')
const _ = require('lodash')
const expect = require('Chai').expect;

function checkNagiosResult( res, hasPerfData = true, expectedCurrentState = null ){
	expect(res.statusCode).to.equal(200);
	assert.strictEqual(typeof res.body, 'string')
	let r = res.body.split('|')
	assert.strictEqual(typeof parseInt(r[0]), 'number', 'currentState is not number' )
	if (hasPerfData)
		assert.strictEqual(r.length, 3, "result does not contains 2 '|'")		
	else
		assert.strictEqual(r.length, 2, "result does not contains 1 '|'")	

	if (expectedCurrentState !== null)
		assert.strictEqual(parseInt(r[0], 10), expectedCurrentState, "currentState != "+expectedCurrentState)		
}

describe('plugin-metrics', function() 
{
	describe('GET metrics getInfos', function() {

		it('should return object', function (done) {

			request( getHttpOptions('GET', '/_plugin/metrics') )
			.then( (res) => {		
			
				expect(res.statusCode).to.equal(200);
				assert.strictEqual(typeof res.body, 'object')	
				assert.strictEqual( _.isArray(res.body.metrics) , true, 'body.metrics is not array')		
				assert.strictEqual( res.body.metrics.length , 5, 'body.metrics length is not 5')		

				let cpuMetric =  res.body.metrics[0]
				assert.strictEqual( cpuMetric.name , 'cpu')			
				assert.strictEqual( cpuMetric.url , 'http://'+HOST+':'+PORT+'/_plugin/metrics/cpu')			
				assert.strictEqual( _.isArray(cpuMetric.args) , true, 'body.metrics[0].args is not array')			

				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});










	describe('GET metrics systemInfo', function() {

		it('should return object', function (done) {

			request( getHttpOptions('GET', '/_plugin/metrics/systemInfo') )
			.then( (res) => {		
			
				expect(res.statusCode).to.equal(200);
				assert.strictEqual(typeof res.body, 'object')	
				assert.strictEqual(typeof res.body.release == 'string', true, "'release' property is not number")	
				assert.strictEqual(typeof res.body.uptime == 'number', true, "'uptime' property is not number'")	
				assert.strictEqual(typeof res.body.osType == 'string', true, "'osType' property is not number'")			
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

	describe('GET metrics systemInfo format=nagios', function() {

		it('should return string', function (done) {

			request( getHttpOptions('GET', '/_plugin/metrics/systemInfo?format=nagios') )
			.then( (res) => {		
				checkNagiosResult( res, false, 0 )				
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});










	describe('GET metrics cpu', function() {

		it('should return object', function (done) {

			request( getHttpOptions('GET', '/_plugin/metrics/cpu') )
			.then( (res) => {		
			
				expect(res.statusCode).to.equal(200);
				assert.strictEqual(typeof res.body, 'object')	
				assert.strictEqual(typeof res.body.ellapsed == 'number', true, "'ellapsed' property is not number")	
				assert.strictEqual(typeof res.body.percentageCPU == 'number', true, "'percentageCPU' property is not number'")					
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

	describe('GET metrics cpu format=nagios', function() {

		it('should return string', function (done) {

			request( getHttpOptions('GET', '/_plugin/metrics/cpu?format=nagios') )
			.then( (res) => {		
				checkNagiosResult( res, true )				
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});
	
	describe('GET metrics cpu warn=10 critic=5 format=nagios', function() {

		it('should return currentState 3', function (done) {

			request( getHttpOptions('GET', '/_plugin/metrics/cpu?warn=10&critic=5&format=nagios') )
			.then( (res) => {		
				checkNagiosResult( res, false, 3 )					
				done();				
			})
			.catch( err => {
				done(err)
			})
		});
	});
	describe('GET metrics cpu warn=0 critic=0 format=nagios', function() {

		it('should return currentState 2', function (done) {

			request( getHttpOptions('GET', '/_plugin/metrics/cpu?warn=0&critic=0&format=nagios') )
			.then( (res) => {		
				checkNagiosResult( res, true, 2 )					
				done();				
			})
			.catch( err => {
				done(err)
			})
		});
	});
	describe('GET metrics cpu warn=0 critic=100 format=nagios', function() {

		it('should return currentState 1', function (done) {

			request( getHttpOptions('GET', '/_plugin/metrics/cpu?warn=0&critic=100&format=nagios') )
			.then( (res) => {		
				checkNagiosResult( res, true, 1 )					
				done();				
			})
			.catch( err => {
				done(err)
			})
		});
	});





















	describe('GET metrics memory', function() {

		it('should return object', function (done) {

			request( getHttpOptions('GET', '/_plugin/metrics/memory') )
			.then( (res) => {		
			
				expect(res.statusCode).to.equal(200);
				assert.strictEqual(typeof res.body, 'object')	
				assert.strictEqual(typeof res.body.usedPercent == 'number', true, "'usedPercent' property is not number")	
				assert.strictEqual(typeof res.body.usedMem == 'number', true, "'usedMem' property is not number'")					
				assert.strictEqual(typeof res.body.totalMem == 'number', true, "'totalMem' property is not number'")					
				
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});
	
	describe('GET metrics memory format=nagios', function() {

		it('should return string', function (done) {

			request( getHttpOptions('GET', '/_plugin/metrics/memory?format=nagios') )
			.then( (res) => {		
				
				checkNagiosResult( res, true )					
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});
	
	describe('GET metrics memory warn=10 critic=5 format=nagios', function() {

		it('should return currentState 3', function (done) {
			request( getHttpOptions('GET', '/_plugin/metrics/memory?warn=10&critic=5&format=nagios') )
			.then( (res) => {		
				checkNagiosResult( res, false, 3)	
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

	describe('GET metrics memory warn=0 critic=0 format=nagios', function() {

		it('should return currentState 2', function (done) {

			request( getHttpOptions('GET', '/_plugin/metrics/memory?warn=0&critic=0&format=nagios') )
			.then( (res) => {		
				checkNagiosResult( res, true, 2 )					
				done();				
			})
			.catch( err => {
				done(err)
			})
		});
	});

	describe('GET metrics memory warn=0 critic=100 format=nagios', function() {

		it('should return currentState 1', function (done) {

			request( getHttpOptions('GET', '/_plugin/metrics/memory?warn=0&critic=100&format=nagios') )
			.then( (res) => {		
				checkNagiosResult( res, true, 1 )					
				done();				
			})
			.catch( err => {
				done(err)
			})
		});
	});















	describe('GET metrics load', function() {

		it('should return object', function (done) {

			request( getHttpOptions('GET', '/_plugin/metrics/load') )
			.then( (res) => {		
			
				expect(res.statusCode).to.equal(200);
				assert.strictEqual(typeof res.body, 'object')	
				assert.strictEqual(typeof res.body.load1 == 'number', true, "'load1' property is not number")	
				assert.strictEqual(typeof res.body.load5 == 'number', true, "'load5' property is not number'")					
				assert.strictEqual(typeof res.body.load15 == 'number', true, "'load15' property is not number'")					
				
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});
	
	describe('GET metrics load format=nagios', function() {

		it('should return string', function (done) {

			request( getHttpOptions('GET', '/_plugin/metrics/load?format=nagios') )
			.then( (res) => {		
				
				checkNagiosResult( res, true )					
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});
	
	describe('GET metrics load warn=10 critic=5 format=nagios', function() {

		it('should return currentState 3', function (done) {
			request( getHttpOptions('GET', '/_plugin/metrics/load?warn=10&critic=5&format=nagios') )
			.then( (res) => {		
				checkNagiosResult( res, false, 3)	
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

	describe('GET metrics load warn1=10 critic1=5 format=nagios', function() {

		it('should return currentState 3', function (done) {
			request( getHttpOptions('GET', '/_plugin/metrics/load?warn1=10&critic1=5&format=nagios') )
			.then( (res) => {		
				checkNagiosResult( res, false, 3)	
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

	describe('GET metrics load warn5=10 critic5=5 format=nagios', function() {

		it('should return currentState 3', function (done) {
			request( getHttpOptions('GET', '/_plugin/metrics/load?warn5=10&critic5=5&format=nagios') )
			.then( (res) => {		
				checkNagiosResult( res, false, 3)	
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

	describe('GET metrics load warn15=10 critic15=5 format=nagios', function() {

		it('should return currentState 3', function (done) {
			request( getHttpOptions('GET', '/_plugin/metrics/load?warn15=10&critic15=5&format=nagios') )
			.then( (res) => {		
				checkNagiosResult( res, false, 3)	
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

	describe('GET metrics load warn=0 critic=0 format=nagios', function() {

		it('should return currentState 2', function (done) {

			request( getHttpOptions('GET', '/_plugin/metrics/load?warn=0&critic=0&format=nagios') )
			.then( (res) => {		
				checkNagiosResult( res, true, 2 )					
				done();				
			})
			.catch( err => {
				done(err)
			})
		});
	});

	describe('GET metrics load warn=0 critic=100 format=nagios', function() {

		it('should return currentState 1', function (done) {

			request( getHttpOptions('GET', '/_plugin/metrics/load?warn=0&critic=100&format=nagios') )
			.then( (res) => {		
				checkNagiosResult( res, true, 1 )					
				done();				
			})
			.catch( err => {
				done(err)
			})
		});
	});
















	describe('GET metrics disks', function() {

		it('should return object', function (done) {

			request( getHttpOptions('GET', '/_plugin/metrics/disks') )
			.then( (res) => {		
			
				expect(res.statusCode).to.equal(200);
				assert.strictEqual(typeof res.body, 'object')	

				/*
				{
					C:: {
					name: "C:",
					free: 5695320064,
					total: 128033222656,
					used: 122337902592,
					totalGO: 119.2,
					usedGO: 113.9,
					freeGO: 5.3,
					usedPercent: 96,
					isValid: true
					},
				*/

				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});
	
	describe('GET metrics disks format=nagios', function() {

		it('should return string', function (done) {

			request( getHttpOptions('GET', '/_plugin/metrics/disks?format=nagios') )
			.then( (res) => {		
				
				checkNagiosResult( res, true )					
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});
	
	describe('GET metrics disks warn=10 critic=5 format=nagios', function() {

		it('should return currentState 3', function (done) {
			request( getHttpOptions('GET', '/_plugin/metrics/disks?warn=10&critic=5&format=nagios') )
			.then( (res) => {		
				checkNagiosResult( res, false, 3)	
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

	describe('GET metrics disks fs=blablabla format=nagios', function() {

		it('should return currentState 3', function (done) {
			request( getHttpOptions('GET', '/_plugin/metrics/disks?fs=blablabla&format=nagios') )
			.then( (res) => {		
				checkNagiosResult( res, false, 3)	
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

	describe('GET metrics disks warn=0 critic=0 format=nagios', function() {

		it('should return currentState 2', function (done) {

			request( getHttpOptions('GET', '/_plugin/metrics/disks?warn=0&critic=0&format=nagios') )
			.then( (res) => {		
				checkNagiosResult( res, true, 2 )					
				done();				
			})
			.catch( err => {
				done(err)
			})
		});
	});

	describe('GET metrics disks warn=0 critic=100 format=nagios', function() {

		it('should return currentState 1', function (done) {

			request( getHttpOptions('GET', '/_plugin/metrics/disks?warn=0&critic=100&format=nagios') )
			.then( (res) => {		
				checkNagiosResult( res, true, 1 )					
				done();				
			})
			.catch( err => {
				done(err)
			})
		});
	});
});
