import {HttpError} from './HttpError'

export class Forbidden extends HttpError {
	constructor(message: string = null, code = 403) {
		if (!message) {
			message = 'Forbidden';
		}
		super(message, code);
	}
}
