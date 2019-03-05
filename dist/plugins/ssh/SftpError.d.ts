import { SshError } from './SshError';
export default class SftpError extends SshError {
    protected sftpStatus: number;
    constructor(err: any);
    getDetail(): {
        connected: boolean;
        level: any;
    };
    getHttpStatus(): 400 | 500;
}
