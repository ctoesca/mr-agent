
import {TbaseModule} from '../TbaseModule'
import {WorkerApplication as Application} from '../../WorkerApplication'
import {Tplugin as TmetricsPlugin} from '../../plugins/metrics/Tplugin'
import Promise = require('bluebird')


export class Ttest2 extends TbaseModule {

	constructor(opt: any) {

		super(opt);
	}

	public test1(args: any) {
		return 'TEST2222222222 ' + args
	}
	public checkPhysicalMem(args: any): Promise<any> {

		let plugin: TmetricsPlugin = (Application.getInstance() as Application).getPluginInstance('metrics') as TmetricsPlugin
		return plugin.getMetric('memory').get(args)

	}
}



