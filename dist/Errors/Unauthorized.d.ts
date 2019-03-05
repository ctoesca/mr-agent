import { HttpError } from './HttpError';
export declare class Unauthorized extends HttpError {
    constructor(message?: string, code?: number);
}
