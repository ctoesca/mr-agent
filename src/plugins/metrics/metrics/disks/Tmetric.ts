

import express = require('express');
import child_process = require('child_process');
import TbaseMetric from '../../TbaseMetric'
import IbaseMetric from '../../IbaseMetric'
import * as utils from '../../../../utils'
import * as Errors from '../../../../Errors'
import Promise = require('bluebird')

export class Tmetric extends TbaseMetric implements IbaseMetric {

	constructor(expressApp: express.Application, config: any) {
		super(expressApp, config);
	}

	public getInfos(): any {
		let r = super.getInfos()
		r.args.push({
			name: 'fs',
			required: false,
			description: 'comma separated disks or filesystems.\nWindows example: fs=C,D\nLinux example: fs=/tmp,/'
		})
		return r
	}

	public get( args: any = null ): Promise<any> {

		let disksParams: any = null

		if (args && args.fs) {
			disksParams = args.fs
			if (disksParams === '') {
				disksParams = null
			}
		}

		let disks: any[] = null
		if (disksParams) {
			disks = disksParams.split(',')
		}

		let bypassUnkownMediaType = (disks === null)
		let promise

		if (utils.isWin()) {
			if (disks) {
				for (let i = 0; i < disks.length; i++) {

					disks[i] = disks[i].toUpperCase()
					if (!disks[i].endsWith(':')) {
						disks[i] += ':'
					}
				}
			}

			promise = this.getWinDisksInfos(bypassUnkownMediaType)

		} else if (process.platform === 'linux') {
			promise = this.getLinuxDisksInfos()
		} else {
			return Promise.reject( new Error('Plateforme non reconnue: ' + process.platform))
		}


		return promise
		.then( disksInfos => {
			let disksHash = {}
			if (disks !== null) {
				for (let i = 0; i < disks.length; i++) {
					if (typeof disksInfos[ disks[i] ] === 'undefined') {
						disksHash[ disks[i] ] = {
							name:  disks[i],
							free: null,
							total: null,
							used: null,
							totalGO: null,
							usedGO: null,
							freeGO: null,
							usedPercent: null,
							isValid: false,
							output: 'Le fs ' + disks[i] + " n'a pas été trouvé"
						}
					} else {
						disksHash[ disks[i] ] = disksInfos[ disks[i] ]
					}
				}
			} else {
				// on ajoute tous les disques
				Object.keys(disksInfos).forEach( (fsName) => {
					disksHash[ fsName ] = disksInfos[fsName]
				})

			}
			return disksHash
		})
	}

	public format( format: string, params: any, result: any ): any {

		params = utils.parseParams(params, {
			warn: {
				default: 80,
				type: 'integer'
			},
			critic: {
				default: 90,
				type: 'integer'
			}
		})

		if (params.warn > params.critic) {
			throw new Errors.HttpError("'warn' cannot be greater than 'critic' (" + params.critic + ')', 400)
		}

		let seuilsInfos = ''

		seuilsInfos = 'seuil warning: ' + params.warn + '% , seuil critic: ' + params.critic + '%'

		let r: any = {
			output: '',
			currentState: 0,
			perfdata: ''
		}
		let state = 'OK'

		Object.keys(result).forEach( (fsName) => {
			let diskInfo = result[fsName]


			if (diskInfo.isValid) {

				if (params.warn !== null) {

					if (diskInfo.usedPercent >= params.warn) {
						state = 'WARNING'
						diskInfo.currentState = 1
						if (r.currentState !== 2) {
							r.currentState = 1
						}
					}
				}

				if (params.critic !== null) {

					if (diskInfo.usedPercent >= params.critic ) {
						diskInfo.currentState = 2
						state = 'CRITIC'
						r.currentState = 2
					}
				}

				diskInfo.output = state + ' - ' + diskInfo.name + ' utilisé à ' + diskInfo.usedPercent + '% (' + diskInfo.freeGO + 'GO libres/' + diskInfo.totalGO + 'Go)'

			} else {
				r.currentState = 3

				if (diskInfo.output) {
					diskInfo.output = 'UNKNOWN - ' + diskInfo.name + ' ' + diskInfo.output
				} else {
					diskInfo.output = 'UNKNOWN - ' + diskInfo.name + ': aucune valeur renvoyée pour ce disque'
				}
			}

			r.output += diskInfo.output + '\n'
			if ((diskInfo.usedPercent !== null) && (diskInfo.used !== null)) {
				r.perfdata += "'" + diskInfo.name + " Space'=" + diskInfo.used + "B; '" + diskInfo.name + " Utilisation'=" + diskInfo.usedPercent + '%;' + params.warn + ';' + params.critic + '; '
			}
		})

		r.output += seuilsInfos
		r.output = r.output.trim()


		if (r.currentState === null) {
			r.currentState = 3
		}

		let _r = r.currentState + '|' + r.output
		if (r.perfdata !== '') {
			_r += '|' + r.perfdata
		}

		return _r

	}


	public getWinDisksInfos( bypassUnkownMediaType = false) {
		return new Promise( (resolve, reject) => {

				/*
				Node,FreeSpace,MediaType,Name,Size
				PC,728547328,12,C:,128033222656
				PC,13018910720,12,D:,209715195904
				PC,0,11,E:,252430336
				PC,71315456,12,F:,104853504
				PC,35056033792,12,G:,262143995904
				PC,6984105984,12,H:,250056220672
				PC,,12,I:,
				PC,8940167168,12,J:,209464979456
				PC,,12,K:,
				PC,,11,L:,
				PC,71315456,0,N:,104853504
				*/


				let cmd = 'WMIC LOGICALDISK GET Name,Size,FreeSpace,MediaType /format:csv'
				let child = child_process.exec(cmd);
				let stdout = '';

				let error = ''
				child.stdout.on('data', (data) => {
					stdout += data;
				});

				child.stderr.on('data', (data) => {
					error += data;
				});

				child.on('error', (err) => {
					error += err.message;
				});

				/*
				child.on('exit', (code) => {
				});
				*/

				child.on('close', (code) => {

					try {
						if (code !== 0) {
							if (error !== '') {
								reject( 'Echec appel ' + cmd + ' :' + error )
							} else {
								reject( 'Echec appel ' + cmd + ' :' + stdout )
							}
						} else if (error !== '' ) {
							reject( 'Echec appel ' + cmd + ' :' + error )
						} else {
							let r = {}
							let lines = stdout.trim().split('\n')

							for (let i = 1; i < lines.length; i++) {
								let line = lines[i].trim()

								// PC,5913124864,12,C:,128033222656
								let parts = line.split(',')

								let diskInfos: any = {
									name: parts[3],
									free: null,
									total: null,
									used: null,
									totalGO: null,
									usedGO: null,
									freeGO: null,
									usedPercent: null,
									isValid: false
								}

								let mediaType: string = parts[2]

								if ( (mediaType === '12') || ( mediaType === '0') ) {
									diskInfos.free = parseInt( parts[1], 10 )
									diskInfos.total = parseInt(parts[4], 10 )

									if (isNaN(diskInfos.free) || isNaN(diskInfos.total)) {
										diskInfos.output = "La requête WMIC n'a renvoyé aucune valeur pour ce disque"

									} else {

										diskInfos.used = diskInfos.total - diskInfos.free
										diskInfos.totalGO = this.convertBytesToGo(diskInfos.total)
										diskInfos.usedGO = this.convertBytesToGo(diskInfos.used)
										diskInfos.freeGO = this.convertBytesToGo(diskInfos.free)
										diskInfos.usedPercent = Math.round( 100 * diskInfos.used / diskInfos.total )
										diskInfos.isValid = true
									}

									r[diskInfos.name] = diskInfos

								} else {

									if (!bypassUnkownMediaType) {
										diskInfos.output = "Ce type de média (%MediaType%) n'est pas connu par ce plugin."

										if (mediaType === '11') {
											diskInfos.output = diskInfos.output.replace('%MediaType%', 'Removable media other than floppy')
										}

										diskInfos.output += ` Types connus: 'Fixed hard disk media (12)', 'Format is unknown (0)'.
										Consultez la page <a target="_blank" href="https://msdn.microsoft.com/en-us/library/aa394173().aspx">https://msdn.microsoft.com/en-us/library/aa394173().aspx</a>`

										r[diskInfos.name] = diskInfos
									}
								}



							}

							resolve(r)
						}

					} catch (err) {
						reject(err)
					}

				});

			})
	}

	public getLinuxDisksInfos() {
		return new Promise( (resolve, reject) => {


				/*
				Filesystem           1K-blocks     Used  Available Use% Mounted on
				udev                   8192680        0    8192680   0% /dev
				tmpfs                  1642364   176216    1466148  11% /run
				/dev/sda3             20026236  4068052   14917852  22% /
				tmpfs                  8211808        0    8211808   0% /dev/shm
				tmpfs                     5120        0       5120   0% /run/lock
				tmpfs                  8211808        0    8211808   0% /sys/fs/cgroup
				/dev/sda2               990488    55892     867064   7% /boot
				/dev/mapper/vg-logs    9943916   393772    9021968   5% /var/log
				/dev/mapper/vg-home 1887444056 65788332 1725756076   4% /home
				tmpfs                  1642364        0    1642364   0% /run/user/1005
				*/

				let cmd = 'df -P';
				let child = child_process.exec(cmd);
				let stdout = '';

				let error = ''
				child.stdout.on('data', (data) => {
					stdout += data;
				});

				child.stderr.on('data', (data) => {
					error += data;
				});

				child.on('error', (err) => {
					error += err.message;
				});

				/*child.on('exit', (code) => {
				});*/

				child.on('close', (code) => {

					try {
						if (code !== 0) {
							if (error !== '') {
								reject( 'Echec appel ' + cmd + ' :' + error )
							} else {
								reject( 'Echec appel ' + cmd + ' :' + stdout )
							}
						} else if (error !== '' ) {
							reject( 'Echec appel ' + cmd + ' :' + error )
						} else {

							let r = {}

							let lines = stdout.split('\n')

							for (let i = 1; i < lines.length; i++) {
								lines[i] = lines[i].trim();

								if (lines[i] !== '') {
									let line = lines[i].trim().replace(/\s+/g, ' ');
									let parts = line.split(' ');

									let name: string = parts[5].trim()

									let diskInfos: any = {
										name: name,
										free: null,
										total: null,
										used: null,
										totalGO: null,
										usedGO: null,
										freeGO: null,
										usedPercent: null,
										isValid: false

									}

									let used: number = parseInt( parts[2] , 10) * 1024
									let free: number = parseInt(parts[3] , 10) * 1024
									let usedPercent: number = parseInt(parts[4].replace('%', ''), 10)

									if (isNaN(used) || isNaN(free) || isNaN(usedPercent)) {
										diskInfos.output = 'Impossible de récupérer les données du fs ' + name
									} else {
										diskInfos.isValid = true
										diskInfos.used = used
										diskInfos.free = free
										diskInfos.total = used + free
										diskInfos.usedGO = this.convertBytesToGo(used)
										diskInfos.freeGO = this.convertBytesToGo(free)
										diskInfos.totalGO = this.convertBytesToGo(diskInfos.total )
										diskInfos.usedPercent = usedPercent
									}

									r[name] = diskInfos

								}
							}

							resolve(r)
						}

					} catch (err) {
						reject(err)
					}

				});

			})
	}


}


