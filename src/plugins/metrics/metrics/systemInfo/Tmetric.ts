
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
		/*uptime: 15564,
		osType: "Windows_NT",
		release: "6.1.7601",
		platform: "win32",
		hostname: "PC"*/

		let hh: number = Math.round( result.uptime / 3600 )
		let jj: number = Math.round(hh / 24)
		let uptime = ''

		if (jj >= 1) {
			uptime += jj + ' jour'
		}
		if (jj >= 2) {
			uptime += 's'
		}

		if (uptime !== '') {
			uptime += ' '
		}

		if (hh <= 1) {
			uptime += hh + ' heure'
		} else {
			uptime += hh + ' heures'
		}

		return '0|' + result.hostname + ': ' + result.osType + '/' + result.release + ', démarré il y a ' + uptime
	}
}


