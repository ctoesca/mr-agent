
import {TbaseModule} from '../TbaseModule'
import {Application} from '../../Application'
import {Ttest2} from './Ttest2'



export class Ttest extends TbaseModule {

	constructor(opt: any) {

		super(opt);
		this.registerModule('checker2', Ttest2 )

	}

	public test1(args: any) {
		Application.getLogger().error('TEST1!!!!!!!!!! ', args)
		return 'TEST1'
	}
	public checkPhysicalMem(args: any) {
		Application.getLogger().error('checkPhysicalMem !!!!!!!!!!', args)

		return 'checkPhysicalMem'
	}
}



