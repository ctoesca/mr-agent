

import * as mrAgent from '.'

import * as utils from './utils'
import parseArgs = require('minimist')
import cluster = require('cluster')
import os = require('os')

if (utils.isWin()) {
	let osRelease: any = os.release()
	let isLessThanWin2008 = ( osRelease.split('.')[0] < 6 )
	if (isLessThanWin2008) {
		console.error('MR-Agent is not compatible with ' + osRelease)
		process.exit(1)
	}
}

let args = parseArgs(process.argv.slice(2));

let configPath: any = __dirname + '/../conf/config.js'
if (args.c) {
	configPath = args.c;
}

if (cluster.isMaster) {
	let app = mrAgent.create( mrAgent.MasterApplication, configPath)
	app.start()
} else {
	let app = mrAgent.create( mrAgent.WorkerApplication, configPath)
	app.start()
}

