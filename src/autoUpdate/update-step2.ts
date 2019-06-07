/*
- started with node copy
- remove,
- copy new version
*/


import parseArgs = require('minimist')
import * as mrAgent from '..'
import bunyan = require('bunyan');
import fs = require('fs-extra')

let args = parseArgs(process.argv.slice(2));

let configPath: any = __dirname + '/../../conf/config.js'
if (args.c) {
	configPath = args.c;
}

let updateDir: string = null
if (args.updateDir) {
	updateDir = args.updateDir
} else {
	throw 'Missing argument: --updateDir'
}

let appUrl: string = null
if (args.appUrl) {
	appUrl = args.appUrl
} else {
	throw 'Missing argument: --appUrl'
}

let appDir: string = null
if (args.appDir) {
	appDir = args.appDir
} else {
	throw 'Missing argument: --appDir'
}

let app = mrAgent.create( mrAgent.WorkerApplication, configPath)
let updater = new mrAgent.Updater(app as mrAgent.WorkerApplication)


let logDir = appDir + '/logs'
fs.ensureDirSync(logDir);

updater.logger = bunyan.createLogger({
	name: 'updater-step2',
	streams: [{
		path: logDir + '/updater-step2.log'
	}]
});

updater.execUpdateStep2(appDir, updateDir, appUrl)
.catch((err: any) => {
	console.log(err)
})
