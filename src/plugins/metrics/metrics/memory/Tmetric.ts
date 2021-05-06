
//import os = require('os');
import * as utils from '../../../../utils'
import TbaseMetric from '../../TbaseMetric'
import IbaseMetric from '../../IbaseMetric'
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

			r.swap.used.pct = utils.round(  r.swap.used.bytes / r.swap.total, 4)
			r.used.pct = utils.round(  r.used.bytes / r.total, 4)
			r.actual.used.pct = utils.round(  r.actual.used.bytes / r.total, 4)

			return r

		})
		
	}

	public format( format: string, params: any, result: any ): any {

		return result
	}

}


