"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IISHttpAccessParser = void 0;
const Application_1 = require("../../../Application");
const TbaseParser_1 = require("./TbaseParser");
const moment = require("moment");
class IISHttpAccessParser extends TbaseParser_1.TbaseParser {
    constructor(masks) {
        super();
        this.directives = [];
        let sizes = {};
        for (let j = 0; j < masks.length; j++) {
            let mask = masks[j];
            let format = mask.split(' ');
            if (sizes[format.length]) {
                throw 'IISHttpAccessParser: plusieurs masks ont le même nombre de champs';
            }
            sizes[format.length] = true;
            this.directives.push([]);
            for (let i = 0; i < format.length; i++) {
                this.directives[j].push(format[i].replace('$', ''));
            }
        }
        this.logger = Application_1.Application.getLogger('IISHttpAccessParser');
    }
    parse(line) {
        let row = {
            request: null,
            clientip: null,
            auth: null,
            ident: null,
            timestamp: null,
            verb: null,
            httpversion: null,
            response: null,
            bytes: null,
            referrer: null,
            agent: null,
            time_taken: null
        };
        let data = line.split(' ');
        let directive = null;
        for (let i = 0; i < this.directives.length; i++) {
            if (data.length === this.directives[i].length) {
                directive = this.directives[i];
                break;
            }
        }
        if (!directive) {
            return null;
        }
        for (let i = 0; i < data.length; i++) {
            let key = directive[i];
            row[key] = data[i];
            if (row[key] === '-') {
                row[key] = null;
            }
        }
        row['@timestamp'] = moment(row.date + 'T' + row.time + 'Z').format();
        row.date = undefined;
        row.time = undefined;
        return row;
    }
}
exports.IISHttpAccessParser = IISHttpAccessParser;
//# sourceMappingURL=IISHttpAccessParser.js.map