

import {WorkerApplication as Application}  from '../WorkerApplication'
import {TbasePlugin} from './TbasePlugin'


import express = require('express')

export class ThttpPlugin extends TbasePlugin {

	public app: express.Application = null

	constructor(application: Application, config: any) {

		super(application, config);

	}

	public install() {
		super.install()
		this.app = express()
	}


}



