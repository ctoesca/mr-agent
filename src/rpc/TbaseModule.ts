
import EventEmitter = require('events');
import {TrpcClient} from './TrpcClient'

export class TbaseModule extends EventEmitter {

	protected opt: any = null
	protected name: string = null
	protected rpcClient: TrpcClient = null
	protected modules: any = {}

	constructor(opt: any) {

		super();
		this.opt = opt
		this.name = opt.name
		this.rpcClient = opt.rpcClient
	}

	public registerModule( name: string, module: any ) {
		this.modules[name] = new module({
			rpcClient: this.rpcClient,
			name: name
		})
	}

	public getModuleMethod(path: string) {
		// path = test.test1
		if (!path.contains('.')) {
			if (typeof this[path] !== 'undefined') {
				return this[path].bind(this)
			} else {
				throw "Method '" + path + "' does not exist on module '" + this.name + "'"
			}
		} else {
			let parts = path.split('.')
			let moduleName = parts[0]
			if (typeof this.modules[moduleName] !== 'object') {
				throw "Module '" + moduleName + "' does not exist on module " + this.name
			}
			let module = this.modules[moduleName]
			return module.getModuleMethod(path.rightOf(moduleName + '.'))
		}

	}

}



