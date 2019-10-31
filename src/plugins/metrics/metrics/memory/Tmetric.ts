
import os = require('os');
import * as utils from '../../../../utils'
import TbaseMetric from '../../TbaseMetric'
import IbaseMetric from '../../IbaseMetric'
import * as Errors from '../../../../Errors'
import express = require('express');
import Promise = require('bluebird')

export class Tmetric extends TbaseMetric implements IbaseMetric {

	constructor(expressApp: express.Application, config: any) {
		super(expressApp, config);
	}



	public get( args: any = null ): Promise<any> {

		return new Promise( (resolve, reject) => {
			let usedMem = os.totalmem() - os.freemem()
			let usedPercent = Math.round( 100 * ( usedMem / os.totalmem() ) );
			let r: any = {
				usedPercent: usedPercent,
				usedMem : usedMem ,
				totalMem: os.totalmem()
			}
			resolve(r)
		})
	}

	public format( format: string, params: any, result: any ): any {
		/*
		nagios plugin :
		perfdata = 'Physical Memory Used'=3954753536Bytes; 'Physical Memory Utilisation'=46%;90;95;
		output = OK - Physical Memory: Total: 7.999GB - Used: 3.683GB (46%) - Free: 4.316GB (54%)
		*/

		params = utils.parseParams(params, {
			warn: {
				default: 80,
				type: 'integer'
			},
			critic: {
				default: 90,
				type: 'integer'
			}
		})

		if (params.warn > params.critic) {
			throw new Errors.HttpError("'warn' cannot be greater than 'critic' (" + params.critic + ')', 400)
		}

		let state = 'OK'
		let currentState = 0;

		if (result.usedPercent >= params.warn) {
			currentState = 1;
			state = 'WARNING'
		}

		if (result.usedPercent >= params.critic) {
			currentState = 2;
			state = 'CRITIC'
		}

		let output = state + ' - Mémoire physique utilisée : ' + result.usedPercent + '% (' + this.convertBytesToGo(result.usedMem) + 'Go utilisés sur un total de ' + this.convertBytesToGo(result.totalMem) + 'Go)'
		let perfdata = "'Physical Memory Used'=" + result.usedMem + "Bytes; 'Physical Memory Utilisation'=" +  result.usedPercent + '%;' + params.warn + ';' + params.critic;

		return currentState + '|' + output + '|' + perfdata
	}

}


