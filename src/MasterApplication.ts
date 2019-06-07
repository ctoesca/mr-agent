
import cluster = require('cluster')
import os = require('os')
import fs = require('fs-extra')
import Timer from './utils/Timer'
import {Application} from './Application'
import child_process = require('child_process')

export class MasterApplication extends Application {

	public  workersStats: any = {}

	protected workers: Map<number, any> = new Map<number, any>()
	protected  workersArray: any[] = []
	protected statTimer: Timer;
	protected  lastStat: Date = null
	protected numProcesses: any = os.cpus().length
	/*protected  currentSelectedWorker = 0;*/

	constructor( configPath: string, opt: any = {} ) {

		super(configPath, opt)

		if (typeof this.config.numProcesses !== 'undefined') {
			if (this.config.numProcesses === 'auto') {
				this.numProcesses = os.cpus().length
			} else {
				this.numProcesses = this.config.numProcesses
			}
		}

		if (typeof this.config.startScript !== 'undefined') {
			this.execScript(this.config.startScript)
		}

		for (let i = 0; i < this.numProcesses; i++) {
			cluster.fork();
		}

		cluster.on('exit', (worker, code, signal) => {
			this.onExitWorker(worker, code, signal)
		});

		cluster.on('fork', (worker) => {
			this.onForkWorker(worker)
		})


		this.statTimer = new Timer({delay: 20000});
		this.statTimer.on(Timer.ON_TIMER, this.onStatTimer.bind(this));
		this.statTimer.start();

	}

	public execScript( script: string ) {

		return new Promise( (resolve, reject) => {

			this.logger.info('**************  EXCUTION SCRIPT *************')
			this.logger.info(script)

			try {

				let scriptPath = this.config.tmpDir + '/startScript.bat'
				fs.writeFileSync(scriptPath, script)

				let child = child_process.spawn(scriptPath);
				let stdout = '';
				let stderr = '';

				child.stdout.on('data', (data: any) => {
					stdout += data;
				});

				child.stderr.on('data', (data) => {
					stderr += data;
				});
				child.on('error', (err: any) => {
					reject(err)
				})
				child.on('close', (code: number) => {

					this.logger.info('stdout=' + stdout)
					if (stderr) {
						this.logger.error('stderr=' + stderr)
					}

					this.logger.info('*********************************************')
					resolve({
						exitCode: code,
						stdout: stdout,
						stderr: stderr
					})
				})

			} catch (err) {
				reject(err)
			}



		})
	}

	public onStatTimer() {

		if (this.workersStats.logIngest) {
			if (this.lastStat) {
				let now = new Date();
				let diff = now.getTime() - this.lastStat.getTime();

				let createRate = Math.round( (this.workersStats.logIngest.totalCreated / (diff / 1000)) * 10 ) / 10;
				let tauxRejet =  Math.round( (100 * (this.workersStats.logIngest.totalInput - this.workersStats.logIngest.totalCreated) / this.workersStats.logIngest.totalInput) * 10 ) / 10;

				if (createRate > 0) {
					this.logger.info( 'INGEST RATE=' + createRate + '/sec, REJETS=' + tauxRejet + '%, created=' + this.workersStats.logIngest.totalCreated + '/' + this.workersStats.logIngest.totalInput);
				}

				this.lastStat = new Date();
				this.workersStats = {}

			} else {
				this.lastStat = new Date();
			}
		}
	}


	protected onExitWorker(worker: any, code: number, signal: string) {

		this.logger.warn(`worker ${worker.process.pid} died code=` + code);
		this.workers.delete( worker.process.pid )

		for (let i = 0; i < this.workersArray.length; i++) {
			if (this.workersArray[i].process.pid === worker.process.pid) {
				this.workersArray.splice(i, 1)
				break;
			}
		}

		if ((code !== 99) && (code !== 98)) {
			this.logger.warn(`worker ${worker.id} disconnected`);
			if (this.config.forkOnWorkerExit !== false) {
				cluster.fork();
			}
		} else if (code === 98) {
			this.workers.forEach( (w, pid ) => {
				this.logger.info('KILL worker ' + pid)
				process.kill(pid)
			})
			process.exit()

		} else if (code === 99) {
			let supervisorPID: Buffer = fs.readFileSync(this.config.tmpDir + '/PID.txt');
			process.kill( parseInt(supervisorPID.toString(), 10));
			this.workers.forEach( (w, pid ) => {
				this.logger.info('KILL worker ' + pid)
				process.kill(pid)
			})

			process.exit();
		}

		this.emit('worker-exit', worker, code, signal)
	}

	protected onWorkerMessage(msg: any) {
		if (msg.logIngestStats) {
			/*{
				createRate: this.createRate,
				tauxRejet: this.tauxRejet,
				totalCreated: this.totalCreated,
				totalInput: this.totalInput
			}*/
			if (!this.workersStats.logIngest) {
				this.workersStats.logIngest = msg.logIngestStats
			} else {
				Object.keys(msg.logIngestStats).forEach((k) => {
					this.workersStats.logIngest[k] += msg.logIngestStats[k]
				});
			}
		}
	}

	protected onForkWorker(worker: any) {

		this.workers[worker.process.pid] = worker
		this.workersArray.push(worker)

		worker.on('message', (msg: any) => {
			this.onWorkerMessage(msg)
		});

		this.logger.info('************ FORK WORKER **************')
	}
}



