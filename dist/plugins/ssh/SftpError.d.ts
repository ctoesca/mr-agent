import SshError from './SshError';
export default class SftpError extends SshError {
    protected sftpStatus: number;
    constructor(err: any);
    getDetail(): any;
    getHttpStatus(): 500 | 400;
}
