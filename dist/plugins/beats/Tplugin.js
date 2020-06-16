"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tplugin = void 0;
const fs = require("fs-extra");
const TbasePlugin_1 = require("../TbasePlugin");
const WorkerApplication_1 = require("../../WorkerApplication");
const yaml = require("js-yaml");
const p = require("path");
const os = require("os");
const elasticsearch = require("elasticsearch");
const moment = require("moment");
const Timer_1 = require("../../utils/Timer");
const uuid = require("uuid/v4");
const TlogToBunyan_1 = require("./TlogToBunyan");
class Tplugin extends TbasePlugin_1.TbasePlugin {
    constructor(application, config) {
        super(application, config);
        this.modules = new Map();
        this.hostname = os.hostname();
        this.beatsVersion = '6.3.1';
        this.collectedMetrics = [];
        this.elasticDataToSend = [];
        this.timer = null;
        this.beatsConfig = null;
        this.maxCachedMetrics = 10000;
        this.sendingData = false;
        let beatsConfigFile = p.normalize(WorkerApplication_1.WorkerApplication.getConfigDir() + '/beats.yml');
        if (fs.existsSync(beatsConfigFile)) {
            try {
                this.beatsConfig = yaml.safeLoad(fs.readFileSync(beatsConfigFile, 'utf8'));
            }
            catch (e) {
                this.logger.error('Error loading beats config \'' + beatsConfigFile + '\' : ' + e.toString());
            }
        }
        else {
            this.logger.error('beats config file \'' + beatsConfigFile + '\' does not exist');
        }
        this.timer = new Timer_1.default({ delay: 5000 });
        this.timer.on(Timer_1.default.ON_TIMER, this.onTimer.bind(this));
        this.timer.start();
    }
    install() {
        super.install();
        let opt = this.config.elasticsearch;
        opt.log = TlogToBunyan_1.default;
        this.elasticClient = new elasticsearch.Client(this.config.elasticsearch);
        this.loadBeats();
    }
    getModule(name) {
        return this.modules.get(name);
    }
    loadBeats() {
        let dir = __dirname + '/modules';
        if (this.beatsConfig) {
            for (let moduleConfig of this.beatsConfig['metricbeat.modules']) {
                try {
                    let moduleName = moduleConfig.module;
                    let clazz = require(dir + '/' + moduleName + '/Tmodule').default;
                    let module = new clazz({
                        tmpDir: this.config.tmpDir + '/' + moduleName,
                        application: this.application,
                        name: moduleName,
                        data: moduleConfig
                    });
                    module.on('metric', this.onMetric.bind(this));
                    module.on('error', this.onError.bind(this));
                    this.modules.set(moduleName, module);
                    this.logger.info("'" + moduleName + "' beat loaded");
                }
                catch (err) {
                    this.logger.error("Error loading '" + moduleConfig.module + "' module : " + err.toString());
                }
            }
        }
    }
    createMetric(module, metricset) {
        let metricData = {
            '@timestamp': moment().toISOString(),
            'metricset': metricset
        };
        metricData.beat = {
            'version': this.beatsVersion,
            'name': 'mr-agent',
            'hostname': this.hostname
        };
        metricData.host = {
            name: this.hostname
        };
        if (this.beatsConfig.fields) {
            if (this.beatsConfig.fields_under_root) {
                Object.keys(this.beatsConfig.fields).forEach((k) => {
                    metricData[k] = this.beatsConfig.fields[k];
                });
            }
            else {
                metricData.fields = this.beatsConfig.fields;
            }
        }
        return metricData;
    }
    onMetric(module, metricset, data) {
        let metricData = this.createMetric(module, metricset);
        metricData[module.name] = data;
        this.collectedMetrics.push(metricData);
    }
    onError(module, metricset, err) {
        let metricData = this.createMetric(module, metricset);
        metricData.error = {
            message: err.toString()
        };
        this.collectedMetrics.push(metricData);
    }
    genUID(metric) {
        let id = Buffer.from(uuid()).toString('base64');
        return id;
    }
    onTimer() {
        this.sendToElastic()
            .catch((err) => {
            this.logger.error(err.toString());
        });
    }
    sendToElastic() {
        if ((this.elasticDataToSend.length === 0) && (this.collectedMetrics.length === 0)) {
            return Promise.resolve();
        }
        try {
            let metricsToSendCount = this.elasticDataToSend.length / 2;
            if (metricsToSendCount >= this.maxCachedMetrics) {
                this.logger.warn('sendToElastic: metrics cache limit reached (' + metricsToSendCount + ' metrics in cache, max: ' + this.maxCachedMetrics + ')');
            }
            else {
                for (let i = 0; i < this.collectedMetrics.length; i++) {
                    let metric = this.collectedMetrics[i];
                    let index = this.config.index + '-' + moment().format('YYYY.MM.DD');
                    this.elasticDataToSend.push({
                        'index': {
                            '_index': index,
                            '_type': 'doc'
                        }
                    });
                    this.elasticDataToSend.push(metric);
                }
            }
            metricsToSendCount = this.elasticDataToSend.length / 2;
            this.collectedMetrics = [];
            this.sendingData = true;
            return this.elasticClient.bulk({
                body: this.elasticDataToSend
            })
                .then(result => {
                this.sendingData = false;
                let errors = 0;
                let created = 0;
                for (let item of result.items) {
                    let isError = !item.index || (item.index.status !== 201);
                    if (isError) {
                        errors++;
                        this.logger.error(item);
                    }
                    else {
                        created++;
                    }
                }
                if (metricsToSendCount !== result.items.length) {
                    this.logger.error('bulk error: created: ' + created + ' (items to create: ' + metricsToSendCount + ', errors: ' + errors);
                }
                else {
                    this.logger.info('bulk result: created: ' + created + ', errors: ' + errors);
                }
                this.elasticDataToSend = [];
            })
                .catch((err) => {
                this.sendingData = false;
            });
        }
        catch (err) {
            this.logger.error('sendToElastic: ', err);
            this.elasticDataToSend = [];
            this.sendingData = false;
            return Promise.reject(err);
        }
    }
}
exports.Tplugin = Tplugin;
//# sourceMappingURL=Tplugin.js.map