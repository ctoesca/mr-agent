
import TbaseModule from '../../TbaseModule'
import IbaseModule from '../../IbaseModule'
import * as utils  from '../../../../utils'
import os = require('os')
import si = require('systeminformation');

export default class Tmodule extends TbaseModule implements IbaseModule {

	protected oldCpus: any = null

	constructor(config: any) {
		super(config);
	}

	public processes() {
		si.processes()
		.then( (results: any) => {
			/*
			 "process": {
			  "name": "elasticsearch-service-x64.exe",
			  "pid": 24656,
			  "memory": {
				"size": 1550786560,
				"rss": {
				  "pct": 0.2362,
				  "bytes": 1521512448
				},
				"share": 0
			  },
			  "state": "running",
			  "cmdline": "G:\\dev\\bin\\elasticsearch-6.3.0\\bin\\elasticsearch-service-x64.exe //RS//elasticsearch-6.3.0",
			  "ppid": 608,
			  "pgid": 0,
			  "cpu": {
				"total": {
				  "value": 681286,
				  "pct": 0.1015,
				  "norm": {
					"pct": 0.0127
				  }
				},
				"start_time": "2019-02-09T11:53:01.175Z"
			  },
			  "username": "AUTORITE NT\\Système"
			}
			*/

			for (let item of results.list) {
				if (item.name.contains('chrome.exe') && (item.pcpu > 1)) {
					this.logger.error(item)
				}
			}

		})

		/*{
		  "pid": 21972,
		  "parentPid": 22160,
		  "name": "node.exe",
		  "pcpu": 0.21687697160883282,
		  "pcpuu": 0.1774447949526814,
		  "pcpus": 0.03943217665615142,
		  "pmem": 0.9488941545169296,
		  "priority": 8,
		  "mem_vsz": 51364,
		  "mem_rss": 59684,
		  "nice": 0,
		  "started": "2019-02-09 14:22:25",
		  "state": "unknown",
		  "tty": "",
		  "user": "",
		  "command": "G:\\dev\\nexilearn\\mr-agent\\node\\node.exe G:\\dev\\nexilearn\\mr-agent\\dist\\starter"
		},
		{
		  "pid": 25624,
		  "parentPid": 21972,
		  "name": "cmd.exe",
		  "pcpu": 0,
		  "pcpuu": 0,
		  "pcpus": 0,
		  "pmem": 0.052465496781480256,
		  "priority": 8,
		  "mem_vsz": 2564,
		  "mem_rss": 3300,
		  "nice": 0,
		  "started": "2019-02-09 14:23:14",
		  "state": "unknown",
		  "tty": "",
		  "user": "",
		  "command": "C:\\Windows\\system32\\cmd.exe /s /c \"C:\\Windows\\system32\\wbem\\wmic.exe process get /value\""
			}
			*/
		}

		public memory() {
			// this.processes()

		/*
		{
			  "free": 12767653888,
			  "actual": {
				"free": 19576565760,
				"used": {
				  "pct": 0.0621,
				  "bytes": 1297285120
				}
			  },
			  "swap": {
				"total": 1605365760,
				"used": {
				  "pct": 0,
				  "bytes": 0
				},
				"free": 1605365760
			  },
			  "total": 20873850880,
			  "used": {
				"bytes": 8106196992,
				"pct": 0.3883
		}
		*/
		if (this.config.data.metricsets.indexOf('memory') >= 0) {

			return si.mem()
			.then( result => {
				/* (total=6440804352,
				free=220430336,
				used=6220374016,
				active=6220374016,
				available=220430336,
				buffcache=0,
				swaptotal=6440353792,
				swapused=1776287744,
				swapfree=4664066048)
				*/
				let r: any = {
					memory: {
						free: result.free,
						total: result.total,
						actual: {
							free: result.available,
							used: {
								'pct': null,
								'bytes': result.active
							}
						},
						swap: {
							total: result.swaptotal,
							used: {
								pct: null,
								bytes: result.swapused
							},
							free: result.swapfree
						},
						used: {
							bytes: result.used,
							pct: null
						}
					}
				}

				r.memory.swap.used.pct = utils.round(  r.memory.swap.used.bytes / r.memory.swap.total, 4)
				r.memory.used.pct = utils.round(  r.memory.used.bytes / r.total, 4)
				r.memory.actual.used.pct = utils.round(  r.memory.actual.used.bytes / r.total, 4)

				this.emit('metric', this, this.getMetricset('memory'), r)

			})
		}
	}

	public load() {
		/*
		{
			"1": 0,
			"5": 0.01,
			"15": 0.05,
			"norm": {
				"1": 0,
				"5": 0.0008,
				"15": 0.0042
			},
			"cores": 12
		}*/
		if (this.config.data.metricsets.indexOf('load') >= 0) {
			let load = os.loadavg()
			let cores: number = os.cpus().length

			let r: any = {
				load: {
					'1': utils.round(load[0], 2),
					'5': utils.round(load[1], 2),
					'15': utils.round(load[2], 2),
					norm: {
						'1': utils.round(load[0] / cores, 3),
						'5': utils.round(load[1] / cores, 3),
						'15': utils.round(load[2] / cores, 3)
					},
					cores: cores
				}
			}

			this.emit('metric', this, this.getMetricset('load'), r)
		}
	}

	public cpu() {
		if (this.config.data.metricsets.indexOf('cpu') >= 0) {

			return this.getOldCpus()
			.then( startCpus => {
				let endCpus: any = this.getCpus()
				this.oldCpus = endCpus

				let r: any = {
					cpu: {
						cores: endCpus.length,
						total: {
							pct: 0,
							norm: {
								pct: null
							}
						}
					}
				}

				for (let i = 0, len = endCpus.length; i < len; i++) {

					let startCpu = startCpus[i];
					let endCpu = endCpus[i];
					let totalTicks = 0

					Object.keys(endCpu.times).forEach( (k: string) => {
						totalTicks += endCpu.times[k] - startCpu.times[k]
					})

					Object.keys(endCpu.times).forEach( (k: string) => {
						let fieldName = k
						if (k === 'sys') {
							fieldName = 'system'
						}

						let pct = ((endCpu.times[k] - startCpu.times[k]) / totalTicks)

						if (typeof r[fieldName] === 'undefined') {
							r.cpu[fieldName] = {
								pct: 0,
								norm: {
									pct: null
								}
							}
						}

						r.cpu[fieldName].pct += pct
						if ((k !== 'idle') && (k !== 'iowait')) {
							r.cpu.total.pct += pct
						}
					})
				}

				let fields = ['total', 'user', 'nice', 'system', 'idle', 'irq', 'iowait', 'softirq', 'steal' ]

				for (let k of fields) {
					if ((typeof r.cpu[k] !== 'undefined')) {
						r.cpu[k].norm.pct = utils.round( r.cpu[k].pct / endCpus.length , 3)
						r.cpu[k].pct = utils.round( r.cpu[k].pct, 3)
					}
				}

				this.emit('metric', this, this.getMetricset('cpu'), r)

			})

		}
	}
	protected getMetricset( metricName: string) {
		return {
			name: metricName,
			module: this.name
		}
	}
	protected getOldCpus() {
		let r = this.oldCpus
		if (!r) {
			return new Promise( (resolve) => {
				r = this.getCpus();
				setTimeout(() => {
					resolve(r)
				}, 2000);

			})
		} else {
			return Promise.resolve(r)
		}
	}

	protected getCpus() {
		let cpus = os.cpus();
		return cpus
	}

	protected onTimer() {

		this.cpu()
		.then( r => {
			this.load()
		})
		.then( r => {
			this.memory()
		})
	}


}


