

export class SshError extends Error {

	public level: any = null
	public connected = false
	public connectionID: string = null
	constructor(message: any, level: any = null) {


		super(message)

		if (typeof message === 'object') {
			this.message = message.toString()
			if (typeof message.level !== 'undefined') {
				this.level = message.level
			}
		}

		if ((level !== null)) {
			this.level = level
		}

		this.message = this.message.trim()

		if (this.message.startsWith('AggregateError: ')) {
			this.message = this.message.rightOf('AggregateError: ')
		}
		if (this.message.startsWith('Error: ')) {
			this.message = this.message.rightOf('Error: ')
		}

	}


	public getDetail() {
		return {
			connected: this.connected,
			level: this.level,
			connectionID: this.connectionID
		}
	}

}



