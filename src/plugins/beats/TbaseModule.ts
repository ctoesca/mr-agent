
import IbaseModule from './IbaseModule'
import bunyan = require('bunyan')
import EventEmitter = require('events')
import fs = require('fs-extra')
import os = require('os')
import {WorkerApplication as Application} from '../../WorkerApplication'
import Timer from '../../utils/Timer'

export default class TbaseModule extends EventEmitter implements IbaseModule {
	public name: any = null;


	protected config: any = null;
	protected application: Application;
	protected logger: bunyan;
	protected timer: Timer = null

	constructor(config: any) {
		super()
		this.config = config
		this.name = config.name
		this.application = config.application
		this.logger = Application.getLogger('beats.' + this.name);

		if (this.config.data.enabled) {
			fs.ensureDir(this.config.tmpDir)
			let period = this.config.data.period.replace('s', '') * 1000
			this.timer = new Timer( { delay: period})
			this.timer.on( Timer.ON_TIMER, this.onTimer.bind(this))
			this.timer.start()
		}
	}
	protected getHost() {
		return {
			name: os.hostname()
		}
	}
	protected onTimer() {
		throw 'onTimer: not implemented'
	}
}


