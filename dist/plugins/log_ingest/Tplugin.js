"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ThttpPlugin_js_1 = require("../ThttpPlugin.js");
const Timer_1 = require("../../utils/Timer");
const elasticsearch = require("elasticsearch");
const moment = require("moment");
const glob = require("glob");
const urlParser = require("url");
const request = require("request");
const bodyParser = require("body-parser");
class Tplugin extends ThttpPlugin_js_1.ThttpPlugin {
    constructor(application, config) {
        super(application, config);
        this.statTimerIterval = 0;
        this.canProcessLocal = false;
        this.currentRemoteAgent = 0;
        this.loadbalance = ['local'];
        this.statTimer = null;
        this.processors = {};
        this.totalCreated = 0;
        this.createRate = 0;
        this.totalInput = 0;
        this.tauxRejet = 0;
        this.lastStat = null;
        this.statTimerIterval = 2;
        this.canProcessLocal = false;
        this.currentRemoteAgent = 0;
        this.loadbalance = ['local'];
        if (this.config && this.config.loadbalance) {
            this.loadbalance = config.loadbalance;
        }
        this.logger.info('logingest nodes: ', this.loadbalance);
    }
    install() {
        super.install();
        this.statTimer = new Timer_1.default({ delay: this.statTimerIterval * 1000 });
        this.statTimer.on(Timer_1.default.ON_TIMER, this.onStatTimer.bind(this));
        this.statTimer.start();
        this.elasticClient = new elasticsearch.Client(this.config.elasticsearch);
        this.app.use(function (req, res, next) {
            let u = urlParser.parse(req.url, true);
            if (u.pathname === '/_bulk') {
                req.headers['content-type'] = 'text/plain';
            }
            next();
        });
        this.app.use(bodyParser.text({
            limit: '500mb'
        }));
        this.app.use(bodyParser.json({
            limit: '500mb'
        }));
        this.app.post('/_bulk', this.ingestData.bind(this));
        this.app.head('/', this.head.bind(this));
        this.app.get('/', this.getRoot.bind(this));
        this.app.get('/_template/:templateName', this.getTemplate.bind(this));
        glob(__dirname + '/processors/*.js', {}, (err, files) => {
            if (!err) {
                for (let i = 0; i < files.length; i++) {
                    let filename = files[i].rightRightOf('/');
                    let processorName = filename.substring(0, filename.length - 3);
                    let classe = require('./processors/' + processorName + '.js').Tprocessor;
                    let opt = null;
                    if (this.config.processors && this.config.processors[processorName]) {
                        opt = this.config.processors[processorName];
                    }
                    this.processors[processorName] = new classe(processorName, opt);
                }
            }
            else {
                this.logger.error(err);
            }
        });
    }
    onStatTimer() {
        if (this.lastStat) {
            let now = new Date();
            let diff = now.getTime() - this.lastStat.getTime();
            this.createRate = Math.round((this.totalCreated / (diff / 1000)) * 10) / 10;
            this.tauxRejet = Math.round((100 * (this.totalInput - this.totalCreated) / this.totalInput) * 10) / 10;
            if (this.createRate > 0) {
                process.send({
                    'logIngestStats': {
                        createRate: this.createRate,
                        tauxRejet: this.tauxRejet,
                        totalCreated: this.totalCreated,
                        totalInput: this.totalInput
                    }
                });
            }
            this.lastStat = new Date();
            this.totalCreated = 0;
            this.totalInput = 0;
        }
        else {
            this.lastStat = new Date();
        }
    }
    getTemplate(req, res) {
        res.send({});
    }
    getRoot(req, res) {
        res.send({});
    }
    ingestData(req, res) {
        this.currentRemoteAgent++;
        if (this.currentRemoteAgent >= this.loadbalance.length) {
            this.currentRemoteAgent = 0;
        }
        if (this.loadbalance[this.currentRemoteAgent] === 'local') {
            this.canProcessLocal = true;
            this.localIngestData(req, res);
        }
        else {
            let url = this.loadbalance[this.currentRemoteAgent];
            this.remoteIngestData(url, req, res)
                .catch((err) => {
                if (this.canProcessLocal) {
                    this.logger.warn('remoteIngestData ' + url + ' (les données vont être traitées en local): ' + err.toString());
                    this.localIngestData(req, res);
                }
                else {
                    this.logger.error('remoteIngestData ' + url + ' (les données se seront pas traitées en local): ' + err.toString());
                }
            });
        }
    }
    remoteIngestData(url, req, res) {
        return new Promise((resolve, reject) => {
            let options = {
                url: url,
                strictSSL: false,
                json: false,
                method: req.method,
                body: req.body,
                headers: req.headers
            };
            request(options, (err, response, body) => {
                if (!err && (response.statusCode >= 400)) {
                    err = body;
                }
                if (err) {
                    reject(err);
                }
                else {
                    res.send(response);
                    resolve(response);
                }
            });
        });
    }
    localIngestData(req, res) {
        let lines = req.body.split('\n');
        let count = 0;
        let dataCount = 0;
        let promises = [];
        for (let i = 0; i < lines.length; i++) {
            if (lines[i] !== '') {
                let isData = ((i + 1) % 2 === 0);
                if (isData) {
                    dataCount++;
                    let data;
                    try {
                        data = JSON.parse(lines[i]);
                    }
                    catch (err) {
                        this.logger.debug('error parsing json data: ', err);
                        res.status(500).send(err);
                        return;
                    }
                    if (typeof data.type !== 'string') {
                        if (typeof data.fields.type !== 'string') {
                            let mess = 'type field is ' + typeof data.type;
                            this.logger.debug(mess, data);
                            res.status(400).send(mess);
                            return;
                        }
                        else {
                            data.type = data.fields.type;
                        }
                    }
                    if (typeof this.processors[data.type] === 'undefined') {
                        this.logger.error('no processor found for type ' + data.type);
                    }
                    else {
                        promises.push(this.processMessage(this.processors[data.type], data));
                    }
                }
                else {
                }
            }
        }
        Promise.all(promises)
            .then((messages) => {
            let body = [];
            for (let i = 0; i < messages.length; i++) {
                let message = messages[i];
                if (message) {
                    message.local_time = moment(message['@timestamp']).format('YYYY-MM-DD HH:mm:ss');
                    body.push({
                        'index': {
                            '_index': message._indexName,
                            '_type': message.type
                        }
                    });
                    message._indexName = undefined;
                    body.push(message);
                    count++;
                }
            }
            if (count > 0) {
                this.bulk(body).then((result) => {
                    this.totalCreated += result.createdCount;
                    this.totalInput += dataCount;
                    this.logger.debug('created: ' + result.createdCount + '/' + dataCount);
                    res.status(200).send(result);
                }, (error) => {
                    console.log('bulk error', error);
                    res.status(200).send(error);
                });
            }
            else {
                res.status(200).send({});
            }
        })
            .catch((err) => {
            this.logger.error('ingestData error : ' + err.toString());
            res.status(500).send(err);
        });
    }
    processMessage(processor, data) {
        return processor.getMessage(data)
            .catch((err) => {
            let logMessage = 'error=' + err + ' ';
            if (data.fields) {
                Object.keys(data.fields).forEach((k) => {
                    logMessage += 'fields.' + k + '=' + data.fields[k] + ' ';
                });
            }
            if (data.host) {
                logMessage += 'host=' + data.host + ' ';
            }
            if (data.beat && data.beat.hostname) {
                logMessage += 'beat.hostname=' + data.beat.hostname + ' ';
            }
            if (data.origin) {
                logMessage += 'origin=' + data.origin + ' ';
            }
            if (data.source) {
                logMessage += 'source=' + data.source + ' ';
            }
            logMessage += 'message=' + data.message;
            logMessage = 'Erreur processMessage ' + processor.name + ': ' + logMessage;
            if (processor.name !== 'bunyan') {
                this.logger.warn(logMessage);
            }
            else {
                console.log(logMessage);
            }
            return false;
        });
    }
    bulk(body) {
        return new Promise((resolve, reject) => {
            if (body.length === 0) {
                resolve({
                    items: [],
                    errors: false,
                    createdCount: 0
                });
            }
            else {
                this.elasticClient.bulk({
                    body: body
                }, (err, resp) => {
                    if (!err) {
                        let sendOk = 0;
                        if (!resp.items) {
                            reject(resp);
                        }
                        else {
                            if (resp.errors) {
                                try {
                                    for (let i = 0; i < resp.items.length; i++) {
                                        if (!resp.items[i].create || (resp.items[i].create.status >= 400)) {
                                            this.logger.debug('error: ', JSON.stringify(resp.items[i]));
                                        }
                                        else {
                                            sendOk++;
                                        }
                                    }
                                }
                                catch (err2) {
                                    this.logger.debug(err2, resp.items);
                                }
                            }
                            else {
                                sendOk = resp.items.length;
                            }
                            resp.createdCount = sendOk;
                            if (sendOk > 0) {
                                resolve(resp);
                            }
                            else {
                                reject(resp);
                            }
                        }
                    }
                    else {
                        this.logger.debug({ err: err }, 'Echec bulk elasticSearch: ' + err.toString());
                        reject(err);
                    }
                });
            }
        });
    }
    head(req, res) {
        res.status(200).send('ok');
    }
}
exports.Tplugin = Tplugin;
//# sourceMappingURL=Tplugin.js.map