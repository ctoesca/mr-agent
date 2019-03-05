import { HttpError } from './HttpError';
export declare class Forbidden extends HttpError {
    constructor(message?: string, code?: number);
}
