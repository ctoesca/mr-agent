
import bunyan = require('bunyan')

export default class TlogToBunyan  {

	public logger: bunyan = null

	constructor() {
		this.logger = bunyan.createLogger({name: 'beats.elasticsearch'});
	}

	public error() {
		this.logger.error.apply(this.logger, arguments);
	}

	public warning() {
		this.logger.warn.apply(this.logger, arguments);
	}

	public info() {
		this.logger.info.apply(this.logger, arguments);
	}

	public debug() {
		this.logger.debug.apply(this.logger, arguments);
	}

	public trace(method: string, requestUrl: string, body: any, responseBody: any, responseStatus: any) {
		this.logger.trace({
				method: method,
				requestUrl: requestUrl,
				body: body,
				responseBody: responseBody,
				responseStatus: responseStatus
		});
	}
	public close() {
		// nothing to do on bunyan
	}
}



