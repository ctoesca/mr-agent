
//import os = require('os');
import * as utils from '../../../../utils'
import TbaseMetric from '../../TbaseMetric'
import IbaseMetric from '../../IbaseMetric'
import * as Errors from '../../../../Errors'
import express = require('express');
import si = require('systeminformation');

export class Tmetric extends TbaseMetric implements IbaseMetric {

	constructor(expressApp: express.Application, config: any) {
		super(expressApp, config);
	}



	public get( args: any = null ):any {
		/*
		{
			  "free": 12767653888,
			  "actual": {
				"free": 19576565760,
				"used": {
				  "pct": 0.0621,
				  "bytes": 1297285120
				}
			  },
			  "swap": {
				"total": 1605365760,
				"used": {
				  "pct": 0,
				  "bytes": 0
				},
				"free": 1605365760
			  },
			  "total": 20873850880,
			  "used": {
				"bytes": 8106196992,
				"pct": 0.3883
		}
		*/

		return si.mem()
		.then( result => {
			/* (total=6440804352,
			free=220430336,
			used=6220374016,
			active=6220374016,
			available=220430336,
			buffcache=0,
			swaptotal=6440353792,
			swapused=1776287744,
			swapfree=4664066048)
			*/
			let r: any = {
				memory: {
					free: result.free,
					total: result.total,
					actual: {
						free: result.available,
						used: {
							'pct': null,
							'bytes': result.active
						}
					},
					swap: {
						total: result.swaptotal,
						used: {
							pct: null,
							bytes: result.swapused
						},
						free: result.swapfree
					},
					used: {
						bytes: result.used,
						pct: null
					}
				}
			}

			r.memory.swap.used.pct = utils.round(  r.memory.swap.used.bytes / r.memory.swap.total, 4)
			r.memory.used.pct = utils.round(  r.memory.used.bytes / r.total, 4)
			r.memory.actual.used.pct = utils.round(  r.memory.actual.used.bytes / r.total, 4)

			return r

		})
		


		/*return new Promise( (resolve, reject) => {
			let usedMem = os.totalmem() - os.freemem()
			let usedPercent = Math.round( 100 * ( usedMem / os.totalmem() ) );
			let r: any = {
				usedPercent: usedPercent,
				usedMem : usedMem ,
				totalMem: os.totalmem()
			}
			resolve(r)
		})*/
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


