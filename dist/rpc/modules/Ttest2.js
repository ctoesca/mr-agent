"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TbaseModule_1 = require("../TbaseModule");
const WorkerApplication_1 = require("../../WorkerApplication");
class Ttest2 extends TbaseModule_1.TbaseModule {
    constructor(opt) {
        super(opt);
    }
    test1(args) {
        return 'TEST2222222222 ' + args;
    }
    checkPhysicalMem(args) {
        let plugin = WorkerApplication_1.WorkerApplication.getInstance().getPluginInstance('metrics');
        return plugin.getMetric('memory').get(args);
    }
}
exports.Ttest2 = Ttest2;
//# sourceMappingURL=Ttest2.js.map