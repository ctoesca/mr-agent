"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tplugin = void 0;
const hoxy = require('hoxy');
const TbasePlugin_1 = require("../TbasePlugin");
class Tplugin extends TbasePlugin_1.TbasePlugin {
    constructor(application, config) {
        super(application, config);
    }
    install() {
        super.install();
        let proxy = hoxy.createServer({})
            .listen(this.config.port);
        proxy.intercept('request', (req, resp, cycle) => {
            var m = req.method + " " + req.protocol + "//" + req.hostname + "/" + req.url;
            this.logger.info(m);
        });
    }
}
exports.Tplugin = Tplugin;
//# sourceMappingURL=Tplugin.js.map