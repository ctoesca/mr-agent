import { HttpError } from './HttpError';
export declare class BadRequest extends HttpError {
    constructor(message?: string, code?: number);
}
