import {HttpError} from './HttpError'

export class NotFound extends HttpError {
	constructor(message: string = null, code = 404) {
		if (!message) {
			message = 'Not Found';
		}
		super(message, code);
	}
}
