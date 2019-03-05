"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const hoxy = require('hoxy');
const TbasePlugin_1 = require("../TbasePlugin");
class Tplugin extends TbasePlugin_1.TbasePlugin {
    constructor(application, config) {
        super(application, config);
    }
    install() {
        super.install();
        let proxy = hoxy.createServer({
            certAuthority: {
                key: fs.readFileSync(__dirname + '/root-ca.key.pem'),
                cert: fs.readFileSync(__dirname + '/root-ca.crt.pem')
            }
        }).listen(this.config.port);
        proxy.intercept('request', (req, resp, cycle) => {
        });
    }
}
exports.Tplugin = Tplugin;
//# sourceMappingURL=Tplugin.js.map