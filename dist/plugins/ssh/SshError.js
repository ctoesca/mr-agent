"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class SshError extends Error {
    constructor(message, level = null) {
        super(message);
        this.level = null;
        this.connected = false;
        this.connectionID = null;
        if (typeof message === 'object') {
            this.message = message.toString();
            if (typeof message.level !== 'undefined') {
                this.level = message.level;
            }
        }
        if ((level !== null)) {
            this.level = level;
        }
        this.message = this.message.trim();
        if (this.message.startsWith('AggregateError: ')) {
            this.message = this.message.rightOf('AggregateError: ');
        }
        if (this.message.startsWith('Error: ')) {
            this.message = this.message.rightOf('Error: ');
        }
    }
    getDetail() {
        return {
            connected: this.connected,
            level: this.level,
            connectionID: this.connectionID
        };
    }
}
exports.default = SshError;
//# sourceMappingURL=SshError.js.map