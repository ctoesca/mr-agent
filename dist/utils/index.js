"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const Timer_1 = require("./Timer");
exports.Timer = Timer_1.default;
require("./StringTools");
const Errors = require("../Errors");
const crypto = require("crypto");
function md5(s) {
    let md5sum = crypto.createHash('md5');
    return md5sum.update(s).digest('hex');
}
exports.md5 = md5;
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}
exports.randomBetween = randomBetween;
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
exports.shuffleArray = shuffleArray;
function isWin() {
    return /^win/.test(process.platform);
}
exports.isWin = isWin;
function isInt(value) {
    let x = parseFloat(value);
    return !isNaN(value) && (x | 0) === x;
}
exports.isInt = isInt;
function isFloat(n) {
    let x = parseFloat(n);
    return !isNaN(x);
}
exports.isFloat = isFloat;
function getIpClient(req) {
    let ip = req.header('X-Forwarded-For');
    if (!ip) {
        ip = req.connection.remoteAddress;
    }
    if (ip === '::1') {
        ip = '127.0.0.1';
    }
    if (ip.startsWith('::ffff:')) {
        ip = ip.rightOf('::ffff:');
    }
    return ip;
}
exports.getIpClient = getIpClient;
function decodeBase64(str) {
    return new Buffer(str, 'base64').toString();
}
exports.decodeBase64 = decodeBase64;
function replaceEnvVars(v) {
    if (typeof v === 'string') {
        Object.keys(process.env).forEach((k) => {
            let value = process.env[k];
            v = v.replace('%' + k + '%', value);
            v = v.replace('${' + k + '}', value);
        });
    }
    return v;
}
exports.replaceEnvVars = replaceEnvVars;
function array_replace_recursive(arr1, arr2) {
    let retObj = {}, i = 0, argl = arguments.length;
    if (argl < 2) {
        throw new Error('There should be at least 2 arguments passed to array_replace_recursive()');
    }
    Object.keys(arr1).forEach((k) => {
        retObj[k] = arr1[k];
    });
    for (let k in arr2) {
        if (retObj[k] && typeof retObj[k] === 'object') {
            retObj[k] = this.array_replace_recursive(retObj[k], arr2[i][k]);
        }
        else {
            retObj[k] = arr2[k];
        }
    }
    return retObj;
}
exports.array_replace_recursive = array_replace_recursive;
function getDateFromTimestamp(d) {
    let r = d.getFullYear().toString() + '-';
    let month = d.getMonth() + 1;
    if (month < 10) {
        r += '0' + month;
    }
    else {
        r += month;
    }
    r += '-';
    let day = d.getDate();
    if (day < 10) {
        r += '0' + day;
    }
    else {
        r += day;
    }
    r += ' ';
    let hour = d.getHours();
    if (hour < 10) {
        r += '0' + hour;
    }
    else {
        r += hour;
    }
    r += ':';
    let min = d.getMinutes();
    if (min < 10) {
        r += '0' + min;
    }
    else {
        r += min;
    }
    r += ':';
    let sec = d.getSeconds();
    if (sec < 10) {
        r += '0' + sec;
    }
    else {
        r += sec;
    }
    return r;
}
exports.getDateFromTimestamp = getDateFromTimestamp;
function parseParams(params, fields, isBodyParams = true) {
    let r = {};
    Object.keys(fields).forEach((fieldName) => {
        if (!(r instanceof Error)) {
            let field = fields[fieldName];
            if (typeof params[fieldName] === 'undefined') {
                if (typeof field.default === 'undefined') {
                    throw new Errors.BadRequest('param \'' + fieldName + '\' is missing');
                }
                else {
                    r[fieldName] = field.default;
                }
            }
            else {
                let value = params[fieldName];
                if (field.type === 'boolean') {
                    if (['true', 'false', '1', '0', true, false].indexOf(value) === -1) {
                        throw new Errors.BadRequest('wrong value for ' + fieldName + ': boolean expected (1, 0, true, false)');
                    }
                    r[fieldName] = ((value === '1') || (value === 'true') || (value === true));
                }
                else if (field.type === 'integer') {
                    if (!isInt(value)) {
                        throw new Errors.BadRequest('wrong value for \'' + fieldName + '\' param: integer expected');
                    }
                    r[fieldName] = parseInt(value, 10);
                }
                else if (field.type === 'float') {
                    if (!isFloat(value)) {
                        throw new Errors.BadRequest('wrong value for \'' + fieldName + '\' param: float expected');
                    }
                    r[fieldName] = parseFloat(value);
                }
                else if (field.type === 'array') {
                    try {
                        if (!isBodyParams) {
                            value = JSON.parse(value);
                        }
                    }
                    catch (err) {
                        throw new Errors.BadRequest(err.toString());
                    }
                    if (!_.isArray(value)) {
                        throw new Errors.BadRequest('wrong value for \'' + fieldName + '\' param: array expected');
                    }
                    r[fieldName] = value;
                }
                else if (field.type === 'object') {
                    try {
                        if (!isBodyParams) {
                            value = JSON.parse(value);
                        }
                    }
                    catch (err) {
                        throw new Errors.BadRequest(err.toString());
                    }
                    if ((typeof value !== 'object') || _.isArray(value)) {
                        throw new Errors.BadRequest('wrong value for \'' + fieldName + '\' param: object expected');
                    }
                    r[fieldName] = value;
                }
                else {
                    r[fieldName] = value;
                }
            }
        }
    });
    return r;
}
exports.parseParams = parseParams;
function round(v, digits = 3) {
    let c = Math.pow(10, digits);
    return Math.round(v * c) / c;
}
exports.round = round;
//# sourceMappingURL=index.js.map