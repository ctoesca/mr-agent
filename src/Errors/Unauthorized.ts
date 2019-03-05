import {HttpError} from './HttpError'

export class Unauthorized extends HttpError {

	constructor(message: string = null, code = 401) {

		if (!message) {
			message = 'Unauthorized';
		}
		super(message, code);
	}
}
