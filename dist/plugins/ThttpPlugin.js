"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThttpPlugin = void 0;
const TbasePlugin_1 = require("./TbasePlugin");
const express = require("express");
class ThttpPlugin extends TbasePlugin_1.TbasePlugin {
    constructor(application, config) {
        super(application, config);
        this.app = null;
    }
    install() {
        super.install();
        this.app = express();
    }
}
exports.ThttpPlugin = ThttpPlugin;
//# sourceMappingURL=ThttpPlugin.js.map