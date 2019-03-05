"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TbaseModule_1 = require("../TbaseModule");
const Application_1 = require("../../Application");
const Ttest2_1 = require("./Ttest2");
class Ttest extends TbaseModule_1.TbaseModule {
    constructor(opt) {
        super(opt);
        this.registerModule('checker2', Ttest2_1.Ttest2);
    }
    test1(args) {
        Application_1.Application.getLogger().error('TEST1!!!!!!!!!! ', args);
        return 'TEST1';
    }
    checkPhysicalMem(args) {
        Application_1.Application.getLogger().error('checkPhysicalMem !!!!!!!!!!', args);
        return 'checkPhysicalMem';
    }
}
exports.Ttest = Ttest;
//# sourceMappingURL=Ttest.js.map