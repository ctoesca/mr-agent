import {HttpError} from './HttpError'

export class BadRequest extends HttpError {
	constructor(message: string = null, code = 400) {
		if (!message) {
			message = 'Bad Request';
		}

		super(message, code);
	}
}
