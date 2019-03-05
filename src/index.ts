import { Application } from './Application';
import { ApplicationConstructor } from './Application';


export { Application } from './Application';
export { MasterApplication } from './MasterApplication';
export { WorkerApplication } from './WorkerApplication';
export { ApplicationConstructor } from './Application';
export { Updater } from './autoUpdate/Updater';

export function create(clazz: ApplicationConstructor, configPath: string, opt: any = {}) {
	return Application.create(clazz, configPath, opt)
}
