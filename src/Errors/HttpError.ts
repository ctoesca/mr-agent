export class HttpError extends Error {

	public code = 0;

	constructor(message: string, code = 1) {
		super(message);
		this.code = code;
	}

}
