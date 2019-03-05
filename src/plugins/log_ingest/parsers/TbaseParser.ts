

import EventEmitter = require('events');
import {Application} from '../../../Application'
import bunyan = require('bunyan');

export class TbaseParser extends EventEmitter {

	protected logger: bunyan = null

	constructor() {

		super();

		this.logger = Application.getLogger(this.constructor.name);
	}

	public parse( line: string ) {

		throw 'TbaseParser.parse() is abstract'
	}

	public escape(str: string) {
		return str.replace(new RegExp('[.*+?|()\\[\\]{}]', 'g'), '\\$&');
	}

}
