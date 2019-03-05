
import bunyan = require('bunyan')
import EventEmitter = require('events')
import {WorkerApplication as Application}  from '../WorkerApplication'
import shell = require('shelljs');

export class TbasePlugin extends EventEmitter {

	public config: any = null
	public name: string = null
	protected tmpDir: string = null
	protected logger: bunyan = null;
	protected application: Application = null;

	constructor(application: Application, config: any) {

		super();

		this.application = application
		this.config = config;
		this.name = config.name;
		this.tmpDir = config.tmpDir;
		this.logger = Application.getLogger(this.name);

		try {
			shell.mkdir('-p', this.tmpDir);
		} catch (e) {
			if ( e.code !== 'EEXIST' ) { throw e; }
		}

	}

	public install() {
		this.logger.debug( 'Plugin ' + this.name + ' installed: opt=', this.config);
	}

}



