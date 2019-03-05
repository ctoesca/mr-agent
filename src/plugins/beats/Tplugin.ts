import fs = require('fs-extra');
import { TbasePlugin } from '../TbasePlugin';
import TbaseModule from './TbaseModule';
import {WorkerApplication as Application}  from '../../WorkerApplication'
import yaml = require('js-yaml');
import p = require('path');
import os = require('os');
import elasticsearch = require('elasticsearch')
import moment = require('moment')
import Timer from '../../utils/Timer'
import uuid = require('uuid/v4')
import TlogToBunyan from './TlogToBunyan'


export class Tplugin extends TbasePlugin {


	public modules: Map<string, TbaseModule> = new Map<string, TbaseModule>()
	protected elasticClient: elasticsearch.Client;
	protected hostname: string = os.hostname()
	protected beatsVersion = '6.3.1'
	protected collectedMetrics: any[] = []
	protected elasticDataToSend: any[] = []
	protected timer: Timer = null
	protected beatsConfig: any = null
	protected maxCachedMetrics = 10000
	protected sendingData = false

	constructor(application: Application, config: any) {

		super(application, config);

		let beatsConfigFile: string = p.normalize( Application.getConfigDir() + '/beats.yml' )
		if (fs.existsSync(beatsConfigFile)) {
			try {
				this.beatsConfig = yaml.safeLoad(fs.readFileSync(beatsConfigFile, 'utf8'));
			} catch (e) {
				this.logger.error('Error loading beats config \'' + beatsConfigFile + '\' : ' + e.toString());
			}
		} else {
			this.logger.error('beats config file \'' + beatsConfigFile + '\' does not exist');
		}

		this.timer = new Timer( { delay: 5000})
		this.timer.on( Timer.ON_TIMER, this.onTimer.bind(this))
		this.timer.start()
	}


	public install() {
		super.install();

		let opt = this.config.elasticsearch
		opt.log = TlogToBunyan
		this.elasticClient = new elasticsearch.Client(this.config.elasticsearch);
		this.loadBeats()
	}

	public getModule(name: string) {
		return this.modules.get(name)
	}

	protected loadBeats() {

		let dir = __dirname + '/modules'

		if (this.beatsConfig) {

			for (let moduleConfig of this.beatsConfig['metricbeat.modules']) {

				try {

					let moduleName = moduleConfig.module
					let clazz = require( dir + '/' + moduleName + '/Tmodule' ).default

					let module = new clazz({
						tmpDir: this.config.tmpDir + '/' + moduleName,
						application: this.application,
						name: moduleName,
						data: moduleConfig
					})
					module.on('metric', this.onMetric.bind(this))
					module.on('error', this.onError.bind(this))
					this.modules.set(moduleName, module)
					this.logger.info("'" + moduleName + "' beat loaded")

				} catch (err) {
					this.logger.error("Error loading '" + moduleConfig.module + "' module : " + err.toString())
				}
			}

		}
	}

	protected createMetric(module: TbaseModule, metricset: any ) {

		let metricData: any = {
			'@timestamp': moment().toISOString(),
			'metricset': metricset
		}

		metricData.beat = {
			'version': this.beatsVersion,
			'name': 'ctop-agent',
			'hostname': this.hostname
		}

		metricData.host = {
			name: this.hostname
		}

		if (this.beatsConfig.fields) {
			if (this.beatsConfig.fields_under_root) {
				Object.keys(this.beatsConfig.fields).forEach( (k) => {
					metricData[k] = this.beatsConfig.fields[k]
				})
			} else {
				metricData.fields = this.beatsConfig.fields
			}
		}
		return metricData
	}

	protected onMetric(module: TbaseModule, metricset: any, data: any) {
		let metricData = this.createMetric(module, metricset)
		metricData[module.name] = data
		this.collectedMetrics.push(metricData)
	}

	protected onError(module: TbaseModule, metricset: any, err: any) {

		let metricData = this.createMetric(module, metricset)

		metricData.error = {
			message: err.toString()
		}
		this.collectedMetrics.push(metricData)

	}
	protected genUID(metric: any) {
		let id = Buffer.from( uuid() ).toString('base64')

		/* let id = metric['@timestamp'] + metric.host.name
		Object.keys(metric.metricset).forEach( (k) => {
			id += metric.metricset[k]
		})
		id = Buffer.from( id ).toString('base64')
		*/
		return id
	}

	protected onTimer() {

		this.sendToElastic()
		.catch( (err: any) => {
			this.logger.error(err.toString())
		})

	}


	protected sendToElastic() {

		if ((this.elasticDataToSend.length === 0) && (this.collectedMetrics.length === 0)) {
			return Promise.resolve();
		}

		try {
			let metricsToSendCount = this.elasticDataToSend.length / 2
			if (metricsToSendCount >= this.maxCachedMetrics) {

				this.logger.warn( 'sendToElastic: metrics cache limit reached (' + metricsToSendCount + ' metrics in cache, max: ' + this.maxCachedMetrics + ')')
			} else {

				for (let i = 0; i < this.collectedMetrics.length; i++) {

					let metric = this.collectedMetrics[i]

					let index: string = this.config.index + '-' + moment().format('YYYY.MM.DD')
					this.elasticDataToSend.push({
						'index' : {
							'_index' : index,
							'_type' : 'doc'
							// '_id': this.genUID(metric)
						}
					});
					this.elasticDataToSend.push(  metric );
				}

			}

			metricsToSendCount = this.elasticDataToSend.length / 2

			this.collectedMetrics = []
			this.sendingData = true;

			return this.elasticClient.bulk({
				body: this.elasticDataToSend
			})
			.then( result => {

				this.sendingData = false

				/*
				{
				  "index": {
					"_index": "test-index",
					"_type": "doc",
					"_id": "XSWExWgBhr0_G_Dwteml",
					"_version": 1,
					"result": "created",
					"_shards": {
					  "total": 2,
					  "successful": 1,
					  "failed": 0
					},
					"_seq_no": 0,
					"_primary_term": 1,
					"status": 201
				  }
				}
				{
					  "index": {
						"_index": "metricbeat-ics-2019.02.09",
						"_type": "doc",
						"_id": "MjAxOS0wMi0wOVQwMTowMjo0MCswMTowMGpteGpvbG9raWE=",
						"status": 400,
						"error": {
						  "type": "mapper_parsing_exception",
						  "reason": "object mapping for [host] tried to parse field [host] as object, but found a concrete value"
						}
					  }
				},
				*/


				let errors = 0;
				let created = 0

				for (let item of result.items) {
					let isError = !item.index || (item.index.status !== 201)
					if (isError) {
						errors ++
						this.logger.error(item)
					} else {
						created ++
					}
				}

				if (metricsToSendCount !== result.items.length) {
					this.logger.error('bulk error: created: ' + created + ' (items to create: ' + metricsToSendCount + ', errors: ' + errors)
				} else {
					this.logger.info('bulk result: created: ' + created + ', errors: ' + errors)
				}

				this.elasticDataToSend = []

			})
			.catch( (err: any) => {
				this.sendingData = false
			})


		} catch (err) {
			this.logger.error('sendToElastic: ', err)
			this.elasticDataToSend = []
			this.sendingData = false
			return Promise.reject(err)
		}

	}
}


