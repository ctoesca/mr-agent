"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ThttpPlugin_js_1 = require("../ThttpPlugin.js");
require("../../utils/StringTools");
const utils = require("../../utils");
const request = require("request");
const bodyParser = require("body-parser");
const Timer_1 = require("../../utils/Timer");
class Tplugin extends ThttpPlugin_js_1.ThttpPlugin {
    constructor(application, config) {
        super(application, config);
        this.runningRequests = 0;
        this.totalRequests = 0;
        this.totalRequestsInIterval = 0;
        this.statInterval = 5000;
        this.requestsPerSec = 0;
        this.statTimer = new Timer_1.default({ delay: this.statInterval });
        this.statTimer.on(Timer_1.default.ON_TIMER, this.onStatTimer.bind(this));
        this.statTimer.start();
    }
    install() {
        super.install();
        this.app.use(bodyParser.json({
            limit: '500mb'
        }));
        this.app.post('/request', this.request.bind(this));
        this.app.get('/stats', this._stats.bind(this));
    }
    onStatTimer() {
        this.requestsPerSec = utils.round(this.totalRequestsInIterval / (this.statInterval / 1000), 1);
        this.totalRequestsInIterval = 0;
        this.logger.debug('runningRequests : ' + this.runningRequests + ', requestsPerSec=' + this.requestsPerSec);
    }
    _stats(req, res, next) {
        this.getStats()
            .then((result) => {
            res.json(result);
        })
            .catch((err) => {
            next(err);
        });
    }
    getStats() {
        let r = {
            pid: process.pid,
            runningRequests: this.runningRequests,
            totalRequests: this.totalRequests,
            requestsPerSec: this.requestsPerSec
        };
        return Promise.resolve(r);
    }
    request(req, res) {
        if (!req.body.headers)
            req.body.headers = {};
        req.body.headers['user-agent'] = 'mr-agent';
        let startTime = new Date().getTime();
        this.runningRequests++;
        this.totalRequests++;
        this.totalRequestsInIterval++;
        if (req.body.pipeResponse) {
            this.logger.info("HTTP(s) PIPED REQUEST : " + req.body.method + " " + req.body.url);
            req.pipe(request(req.body)).pipe(res);
        }
        else {
            let data = [];
            let response;
            request(req.body)
                .on('data', function (chunk) {
                data.push(chunk);
            })
                .on('response', function (resp) {
                response = resp;
            })
                .on('error', (err) => {
                this.runningRequests--;
                let xTime = new Date().getTime() - startTime;
                this.logger.error("HTTP(s) REQUEST : " + req.body.method + " " + req.body.url + ' ' + err.toString());
                let message = err.toString();
                err = JSON.parse(JSON.stringify(err));
                err.message = message;
                let r = {
                    err: err,
                    xTime: xTime
                };
                res.status(200).json(r);
            })
                .on('end', () => {
                this.logger.info("HTTP(s) REQUEST : " + req.body.method + " " + req.body.url);
                this.runningRequests--;
                let xTime = new Date().getTime() - startTime;
                let dataBuffer = Buffer.concat(data);
                let r = {
                    response: response,
                    bodyIsBase64: true,
                    body: dataBuffer.toString('base64'),
                    xTime: xTime
                };
                res.status(200).json(r);
            });
        }
    }
}
exports.Tplugin = Tplugin;
//# sourceMappingURL=Tplugin.js.map