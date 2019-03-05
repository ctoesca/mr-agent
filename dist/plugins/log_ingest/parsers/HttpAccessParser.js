"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TbaseParser_1 = require("./TbaseParser");
const moment = require("moment");
class HttpAccessParser extends TbaseParser_1.TbaseParser {
    constructor(masks) {
        super();
        this.parsers = [];
        let directive = /\$([a-z_]+)(.)?([^\$]+)?/g, match, regex, boundary;
        for (let mask of masks) {
            let regexpString = mask;
            let fields = {};
            let fieldCount = 0;
            let i = 1;
            while ((match = directive.exec(mask))) {
                fields[match[1]] = i++;
                fieldCount++;
                if (match[2]) {
                    boundary = this.escape(match[2]);
                    regex = '([^' + boundary + ']*?)' + boundary;
                    if (match[3]) {
                        regex += this.escape(match[3]);
                    }
                }
                else {
                    regex = '(.+)$';
                }
                regexpString = regexpString.replace(match[0], regex);
            }
            this.parsers.push({
                fieldCount: fieldCount,
                fields: fields,
                mask: mask,
                regexp: new RegExp(regexpString)
            });
        }
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
        let matched = false;
        for (let i = 0; i < this.parsers.length; i++) {
            let parser = this.parsers[i];
            let match = line.toString().match(parser.regexp);
            if (match) {
                matched = true;
                Object.keys(parser.fields).forEach((key) => {
                    row[key] = match[parser.fields[key]];
                    if (row[key] === '-') {
                        row[key] = null;
                    }
                });
                break;
            }
        }
        if (!matched) {
            return null;
        }
        row['@timestamp'] = moment(row.timestamp, 'DD/MMM/YYYY:HH:mm:ss ZZ').format();
        if (row['@timestamp'] === 'Invalid date') {
            this.logger.warn('Invalid date: row.timestamp=' + row.timestamp);
        }
        if (row.request && (row.request.contains('?'))) {
            row.url_querystring = row.request.rightOf('?');
            row.url_path = row.request.leftOf('?');
        }
        else {
            row.url_path = row.request;
        }
        if (row.http_x_forwarded_for) {
            row.clientip = row.http_x_forwarded_for;
        }
        row.timestamp = undefined;
        return row;
    }
}
exports.HttpAccessParser = HttpAccessParser;
//# sourceMappingURL=HttpAccessParser.js.map