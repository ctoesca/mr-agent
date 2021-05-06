import {Tools} from './Tools'
//import * as utils from '../../utils'
import child_process = require('child_process');
import fs = require('fs-extra');

export class TwinTools extends Tools {

	constructor(opt: any) {
		super(opt)
	}

	public execPowershell(script: string, args: any = []): Promise<any> {

		let outFile = this.tmpDir + '\\' + Math.random() + '.ps1';

		return fs.writeFile(outFile , script, 'utf8')
		.then(() => {
			return new Promise((resolve, reject) => {

				try{

					let stdout = '';
					let stderr = '';

					
					let child: child_process.ChildProcess
					
					let commandArgs: string = ''

					if (args.length > 0) {
						for (let i = 0; i < args.length; i++) {
							commandArgs +=  args[i] + ' '
						}
					}
					

					let cmd = 'powershell -NoLogo -NonInteractive -File "' + outFile + '" '+commandArgs

					child = child_process.exec(cmd, {
						maxBuffer: 1024 * 1024 * 2
					});

					child.stdout.on('data', (data: any) => {
						stdout += data;
					});

					child.stderr.on('data', (data: any) => {
						stderr += data;
					});

					child.on('error', (error: any) => {
						this.logger.error(error);
						stderr += error.message;
						reject(error)
					});

					child.on('exit', (code: number) => {
						this.logger.debug('EXIT ' + code);
					});

					child.on('close', (code: number) => {
						
						if (code === null) {
							code = 0;
						}
						resolve({exitCode: code, stdout: stdout, stderr: stderr });

					});

				}catch(err){
					reject(err)
				}

			})
			.finally(() => {
				fs.unlink(outFile)
				.catch((err) => {
					this.logger.error("Echec suppression outFile", err)
				})
			})
		})



	}

}

