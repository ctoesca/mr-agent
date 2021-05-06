
import os = require('os');
import TbaseMetric from '../../TbaseMetric'
import IbaseMetric from '../../IbaseMetric'
import express = require('express');
import Promise = require('bluebird')

export class Tmetric extends TbaseMetric implements IbaseMetric {

	constructor(expressApp: express.Application, config: any) {
		super(expressApp, config);
	}

	public get( args: any = null ): Promise<any> {

		return new Promise( resolve => {
			let r = {
				userInfo: os.userInfo(),
				uptime: os.uptime(),
				osType: os.type(),
				release: os.release(),
				platform: os.platform(),
				hostname: os.hostname()
			}
			resolve( r )
		})
	}

	public format( format: string, params: any, result: any ): any {
		
		return result
	}
}


