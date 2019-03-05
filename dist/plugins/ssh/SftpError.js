"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SshError_1 = require("./SshError");
const Ssh2 = require("ssh2");
class SftpError extends SshError_1.SshError {
    constructor(err) {
        super(err.toString());
        this.sftpStatus = null;
        this.connected = true;
        this.sftpStatus = err.code;
        this.level = Ssh2.SFTP_STATUS_CODE[err.code];
    }
    getDetail() {
        return {
            connected: this.connected,
            level: this.level
        };
    }
    getHttpStatus() {
        if ((this.sftpStatus === 2) || (this.sftpStatus === 3))
            return 400;
        else
            return 500;
    }
}
exports.default = SftpError;
//# sourceMappingURL=SftpError.js.map