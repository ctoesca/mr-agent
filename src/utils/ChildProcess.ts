
import * as Promise from 'bluebird'
import * as child_process from 'child_process'
import './StringTools';

export class ChildProcess {

	public static spawn(path: string, args: string[] = [], opt: any = {}) {

		return new Promise( (resolve, reject) => {
			try {
				let stderr = ''
				let stdout = ''
				let error: any = null

				let child = child_process.spawn(path, args);
				child.stdout.on('data', (data: any) => {
					stdout += data;
					if (opt.logger) {
						opt.logger.info(data.toString());
					}
				});

				child.stderr.on('data', (data: any) => {
					if (opt.logger) {
						opt.logger.error(data.toString());
					}
					stderr += data;
				});

				child.on('error', (err: any) => {
					if (opt.logger) {
						opt.logger.error(err.toString());
					}
					error = err
				});

				/*
				child.on('exit', (code: number) => {
				});
				*/

				child.on('close', (code: number) => {
					if (code === null) {
						code = 0;
					}
					if (!error) {
						resolve({
							stdout: stdout,
							stderr: stderr,
							exitCode: code
						});
					} else {
						reject(error)
					}
				})

			} catch (err) {
				reject(err)
			}

		})
	}

}
