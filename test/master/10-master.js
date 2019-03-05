const assert = require('assert');
//const request = require('request')
const request = require('request-promise')
const _ = require('lodash')
const expect = require('Chai').expect;

describe('MASTER', function() 
{
	
	describe('execScript', function() {

		it('should return exitCode 0', function (done) {

			app.execScript('dir')
			.then( (result) => {			
				if (result.exitCode != 0) {
					done('Failed to execute script')
				}else{
					done();					
				}
			})
			.catch( err => {
				done(err)
			})
		});

	});
	
	describe('execScript', function() {

		it('should return exitCode 1', function (done) {

			app.execScript('dir blablabla')
			.then( (result) => {			
				if (result.exitCode !== 1) {
					done('Failed to execute script')
				}else{
					done();					
				}
			})
			.catch( err => {
				done(err)
			})
		});

	});

	describe('send logIngestStats', function() {

		it('should return ok', function (done) {

			app.onWorkerMessage({
				logIngestStats: {
					totalCreated: 5,
					totalInput: 5,
				}
			})

			app.onWorkerMessage({
				logIngestStats: {
					totalCreated: 5,
					totalInput: 6,
				}
			})

			done()
		
		});

	});


	describe('get logIngestStats', function() {

		it('should return ok', function (done) {
			console.log(app.workersStats)
			app.onStatTimer()
			setTimeout( () => {
				app.onStatTimer()
				done()
			}, 1000)
			
		
		});

	});

});
