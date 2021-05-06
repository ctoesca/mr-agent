

import fs = require('fs');
import express = require('express');
import os = require('os');
import TbaseMetric from '../../TbaseMetric'
import IbaseMetric from '../../IbaseMetric'
//import * as utils from '../../../../utils'
//import * as Errors from '../../../../Errors'
import Promise = require('bluebird')

export class Tmetric extends TbaseMetric implements IbaseMetric {

	constructor(expressApp: express.Application, config: any) {
		super(expressApp, config);
	}

	public get(): Promise<any> {
		return this.cpu()
	}

	/* check sur 5 secondes */
	public cpu( interval = 5000 ) {

		let oldMeasure = this.cpuAverage();
		let endMeasure = null;

		return Promise.delay( interval )
		.then( (result ) => {
			endMeasure = this.cpuAverage();
			let idleDifference = endMeasure.idle - oldMeasure.idle;
			let totalDifference = endMeasure.total - oldMeasure.total;
			let percentageCPU = 100 - (100 * idleDifference / totalDifference);
			percentageCPU = Math.round(percentageCPU * 10)/10
			let timeDiff = Math.round( (new Date().getTime() - oldMeasure.timestamp ) / 1000 )
			this.saveCpuMeasure(endMeasure)
			return {
				ellapsed: timeDiff,
				cores: os.cpus().length,
				total:{
					norm:{
						pct: percentageCPU
					}
				}
				
			}
		})
	}

	public format( format: string, params: any, result: any ): any {
		
		return result

	}


	public cpuAverage() {

		// Initialise sum of idle and time of cores and fetch CPU info
		let totalIdle = 0, totalTick = 0;
		let cpus = os.cpus();

		// Loop through CPU cores
		for (let i = 0, len = cpus.length; i < len; i++) {

			// Select CPU core
			let cpu = cpus[i];

			// Total up the time in the cores tick
			Object.keys(cpu.times).forEach( (type ) => {
				totalTick += cpu.times[type];
			})


			// Total up the idle time of the core
			totalIdle += cpu.times.idle;
		}

		// Return the average Idle and Tick times
		return {timestamp: new Date().getTime(), idle: totalIdle / cpus.length,  total: totalTick / cpus.length};
	}

	public getOldCpuMeasure() {
		let startMeasure: any = null
		let dataPath = this.config.tmpDir + '/cpu.json';
		if (fs.existsSync(dataPath)) {
			try {
				let data: Buffer = fs.readFileSync(dataPath)
				data = JSON.parse(data.toString())
				startMeasure = data
			} catch (err) {
				this.logger.warn('Error reading file ' + dataPath + ': ' + err.toString())
			}
		}

		if (!startMeasure) {
			return new Promise( (resolve) => {
				startMeasure = this.cpuAverage();
				setTimeout(() => {
					resolve(startMeasure)
				}, 2000);

			})
		} else {
			return Promise.resolve(startMeasure)
		}

	}
	public saveCpuMeasure(measure: any) {
		let dataPath = this.config.tmpDir + '/cpu.json';
		fs.writeFileSync(dataPath, JSON.stringify(measure) )
	}


}


