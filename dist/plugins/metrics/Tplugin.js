"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra");
const ThttpPlugin_1 = require("../ThttpPlugin");
const express = require("express");
const bodyParser = require("body-parser");
class Tplugin extends ThttpPlugin_1.ThttpPlugin {
    constructor(application, config) {
        super(application, config);
        this.metrics = new Map();
    }
    install() {
        super.install();
        this.app.use(bodyParser.json({
            limit: '500mb'
        }));
        this.loadMetrics()
            .then(() => {
            this.app.get('/', this.getInfos.bind(this));
        });
    }
    getInfos(req, res, next) {
        let r = {
            metrics: []
        };
        let baseUrl = req.protocol + '://' + req.get('host');
        this.metrics.forEach((metric, metricName) => {
            let info = metric.getInfos();
            info.url = baseUrl + info.url;
            r.metrics.push(info);
        });
        res.json(r);
    }
    loadMetrics() {
        let dir = __dirname + '/metrics';
        return fs.readdir(dir)
            .then((files) => {
            for (let metricName of files) {
                let metricClassPath = dir + '/' + metricName + '/Tmetric';
                try {
                    let clazz = require(metricClassPath).Tmetric;
                    let app = express();
                    this.app.use('/' + metricName, app);
                    let metricConfig = {
                        tmpDir: this.config.tmpDir + '/' + metricName,
                        application: this.application,
                        name: metricName
                    };
                    let metric = new clazz(app, metricConfig);
                    this.logger.debug("'" + metricName + "' metric loaded");
                    this.metrics.set(metricName, metric);
                }
                catch (err) {
                    this.logger.error('Failed to load metric ' + metricClassPath, err);
                }
            }
        });
    }
    getMetric(name) {
        return this.metrics.get(name);
    }
}
exports.Tplugin = Tplugin;
//# sourceMappingURL=Tplugin.js.map