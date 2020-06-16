"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tplugin = void 0;
const ThttpPlugin_js_1 = require("../ThttpPlugin.js");
require("../../utils/StringTools");
const utils = require("../../utils");
const request = require("request");
const bodyParser = require("body-parser");
const Timer_1 = require("../../utils/Timer");
const HttpTools_1 = require("../../utils/HttpTools");
const Errors = require("../../Errors");
const Promise = require("bluebird");
const url = require("url");
const qs = require("qs");
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
        this.app.post('/getSslCertificate', this.getSslCertificate.bind(this));
        this.app.post('/request', this.request.bind(this));
        this.app.post('/requests', this.requests.bind(this));
        this.app.get('/parseQueryString', this.parseQueryString.bind(this));
        this.app.get('/stats', this._stats.bind(this));
    }
    onStatTimer() {
        this.requestsPerSec = utils.round(this.totalRequestsInIterval / (this.statInterval / 1000), 1);
        this.totalRequestsInIterval = 0;
        this.logger.debug('runningRequests : ' + this.runningRequests + ', requestsPerSec=' + this.requestsPerSec);
    }
    parseQueryString(req, res, next) {
        let u = url.parse(req.url, false);
        res.json(qs.parse(u.query));
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
    getSslCertificate(req, res, next) {
        HttpTools_1.HttpTools.getSslCertificate(req.body)
            .then((certificate) => {
            res.json(certificate);
        })
            .catch((err) => {
            next(err);
        });
    }
    requests(req, res, next) {
        try {
            if (typeof req.body.push !== 'function') {
                throw new Errors.BadRequest("body doit être de type array");
            }
            for (var item of req.body) {
                if (item.pipeResponse)
                    throw new Errors.BadRequest("pipeResponse n'est pas disponible sur /requests");
            }
            Promise.map(req.body, (item) => {
                return this._request(item);
            }, { concurrency: 5 })
                .then((results) => {
                res.status(200).json(results);
            });
        }
        catch (err) {
            next(err);
        }
    }
    request(req, res, next) {
        if (req.body.pipeResponse) {
            this.logger.info("HTTP(s) PIPED REQUEST : " + req.body.method + " " + req.body.url);
            req.pipe(request(req.body)).pipe(res);
        }
        else {
            this._request(req.body)
                .then((result) => {
                res.status(200).json(result);
            })
                .catch(err => {
                next(err);
            });
        }
    }
    _request(body) {
        return new Promise((resolve, reject) => {
            this.runningRequests++;
            this.totalRequests++;
            this.totalRequestsInIterval++;
            let startTime = new Date().getTime();
            let data = [];
            let response;
            if (!body.method)
                body.method = "GET";
            if (!body.headers)
                body.headers = {};
            body.headers['user-agent'] = 'mr-agent';
            request(body)
                .on('data', function (chunk) {
                data.push(chunk);
            })
                .on('response', function (resp) {
                response = resp;
            })
                .on('error', (err) => {
                this.runningRequests--;
                let xTime = new Date().getTime() - startTime;
                this.logger.error("HTTP(s) REQUEST : " + body.method + " " + body.url + ' ' + err.toString());
                let message = err.toString();
                err = JSON.parse(JSON.stringify(err));
                err.message = message;
                let r = {
                    err: err,
                    xTime: xTime
                };
                resolve(r);
            })
                .on('end', () => {
                this.logger.info("HTTP(s) REQUEST : " + body.method + " " + body.url);
                this.runningRequests--;
                let xTime = new Date().getTime() - startTime;
                let dataBuffer = Buffer.concat(data);
                let r = {
                    response: response,
                    bodyIsBase64: true,
                    body: dataBuffer.toString('base64'),
                    xTime: xTime
                };
                resolve(r);
            });
        });
    }
}
exports.Tplugin = Tplugin;
//# sourceMappingURL=Tplugin.js.map