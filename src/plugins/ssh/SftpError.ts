
import {SshError} from './SshError'
import Ssh2 = require('ssh2')

export default class SftpError extends SshError {

	protected sftpStatus: number = null;

	constructor(err: any) {


		super(err.toString())

		this.connected = true;

		/*
		var STATUS_CODE_STR = {
		  0: 'No error',
		  1: 'End of file',
		  2: 'No such file or directory',
		  3: 'Permission denied',
		  4: 'Failure',
		  5: 'Bad message',
		  6: 'No connection',
		  7: 'Connection lost',
		  8: 'Operation unsupported'
		};*/
		this.sftpStatus = err.code
		this.level = Ssh2.SFTP_STATUS_CODE[err.code]
	}

	public getDetail() {
		return {
			connected: this.connected,
			level: this.level
		}
	}

	public getHttpStatus() {
		if ((this.sftpStatus === 2) ||  (this.sftpStatus === 3)) {
			return 400
		}
		else {
			return 500
		}
	}

}



