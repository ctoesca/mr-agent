
import TbaseModule from '../../TbaseModule'
import IbaseModule from '../../IbaseModule'
import request = require('request-promise')
import Promise = require('bluebird')

export default class Tmodule extends TbaseModule implements IbaseModule {
	protected mbeans: any[]
	protected path = '/jolokia'
	protected namespace: 'metrics'

	constructor(config: any) {
		super(config);

		/*
			namespace: "metrics"
			jmx.mappings:
			- mbean: 'java.lang:type=Runtime'
			  attributes:
				- attr: Uptime
				  field: uptime
			- mbean: 'java.lang:type=Memory'
			  attributes:
				- attr: HeapMemoryUsage
				  field: memory.heap_usage
				- attr: NonHeapMemoryUsage
				  field: memory.non_heap_usage
			#GC Metrics - this depends on what is available on your JVM
			- mbean: 'java.lang:name=PS Scavenge,type=GarbageCollector'
			  attributes:
				- attr: CollectionTime
				  field: gc.cms_collection_time
				- attr: CollectionCount
				  field: gc.cms_collection_count
				- attr: LastGcInfo
				  field: LastGcInfo
		*/

		this.mbeans = config.data['jmx.mappings']
		if (this.config.data.path) {
			this.path = this.config.data.path
		}
		if (this.config.data.namespace) {
			this.namespace = this.config.data.namespace
		}

	}

	public onTimer() {

		for (let host of this.config.data.hosts) {

			if (this.mbeans.length > 0) {
				let body: any[] = [];

				for (let mbean of this.mbeans) {

					body.push({
						'type' : 'read',
						'mbean' : mbean.mbean,
						'attribute' : mbean.attribute
					})

				}
				this.getMbeans( host, body )
				.then( (result: any) => {
					let r: any = {}
					r[this.namespace] = {}
					let sendResult = false

					for (let i = 0; i < result.responses.length; i++) {
						let item = result.responses[i]
						if (item.error) {
							this.logger.error(item.error)
							this.emit('error', this, this.getMetricset('jmx', host), item.error )
						} else {
							let mbean = this.mbeans[i]
							for (let attribute of mbean.attributes) {
								this.setValue( r[this.namespace], attribute.field, item.value[attribute.attr] )
								sendResult = true
							}
						}
					}

					if (sendResult) {
						this.emit('metric', this, this.getMetricset('jmx', host), r)
					}

				})
				.catch(err => {
					this.emit('error', this, this.getMetricset('jmx', host), err.toString() )
					this.logger.error(err)
				})

			}
		}
	}

	public setValue(obj: any, path: string, value: any) {

		let properties = path.split('.')
		let current = obj

		for (let j = 0; j < properties.length; j++) {
			let propName = properties[j]

			if (j < properties.length - 1) {
				if (typeof current[propName] === 'undefined') {
					current[propName] = {}
				}
			} else {
				current[propName] = value
			}
			current = current[propName]
		}
	}

	public getMbeans(host: string, body: any): Promise<any> {

		let url: string = null
		if (host.startsWith('http')) {
			url = host + this.path
		} else {
			url = 'http://' + host + this.path
		}

		let opt: any = {
			method: 'POST',
			url: url,
			body: body,
			json: true,
			headers: {
				'user-agent': 'mr-agent'
			}
		}
		return request(opt)
		.then((resp) => {

			let r: any = {
				host: host,
				responses: resp
			};

			return r
		})
		.catch(err => {
			throw new Error(opt.method + ' ' + opt.url + ': ' + err.toString())
		})

	}

	protected getMetricset( metricName: string, host: string ) {
		return {
			name: metricName,
			module: this.name,
			namespace: this.name + '.' + this.namespace,
			host: host
		}
	}

}


