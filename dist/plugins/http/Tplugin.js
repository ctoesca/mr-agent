"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ThttpPlugin_js_1 = require("../ThttpPlugin.js");
require("../../utils/StringTools");
const Timer_1 = require("../../utils/Timer");
const request = require("request");
const bodyParser = require("body-parser");
class Tplugin extends ThttpPlugin_js_1.ThttpPlugin {
    constructor(application, config) {
        super(application, config);
        this.runningRequestCount = 0;
        this.requestCount = 0;
        this.statTimer = new Timer_1.default({ delay: 2000 });
        this.statTimer.on(Timer_1.default.ON_TIMER, this.onStatTimer.bind(this));
        this.statTimer.start();
    }
    install() {
        super.install();
        this.app.use(bodyParser.json({
            limit: '500mb'
        }));
        this.app.post('/request', this.request.bind(this));
    }
    onStatTimer() {
        this.logger.debug('runningRequestCount : ' + this.runningRequestCount + ', total=' + this.requestCount);
    }
    request(req, res) {
        let opt = {
            strictSSL: false,
            timeout: 5000
        };
        Object.keys(req.body).forEach((k) => {
            opt[k] = req.body[k];
        });
        let startTime = new Date().getTime();
        this.runningRequestCount++;
        this.requestCount++;
        request(opt, (err, response, body) => {
            this.runningRequestCount--;
            let xTime = new Date().getTime() - startTime;
            let r = {
                isError: true,
                error: null,
                rawError: null,
                body: null,
                status: null,
                xTime: xTime,
                headers: null
            };
            if (err) {
                r.isError = true;
                r.error = err.toString();
                r.rawError = err;
            }
            else {
                r.isError = false;
                r.body = body;
                r.status = response.statusCode;
                r.headers = response.headers;
            }
            res.status(200).json(r);
        });
    }
}
exports.Tplugin = Tplugin;
//# sourceMappingURL=Tplugin.js.map