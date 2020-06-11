import _ = require('lodash')
import express = require('express')
import Timer from './Timer'
import './StringTools';
import * as Errors from '../Errors';
import crypto = require('crypto');



function md5(s: string): string{
	let md5sum = crypto.createHash('md5');
	return md5sum.update(s).digest('hex');
}

function randomBetween(min: number, max: number) {
	return Math.floor(Math.random()*(max-min+1)+min);
}
function shuffleArray(arr: any[]){
		for (let i = arr.length - 1; i > 0; i--) {
	        const j = Math.floor(Math.random() * (i + 1));
	        [arr[i], arr[j]] = [arr[j], arr[i]];
	    }
	    return arr;
	}
function isWin(): boolean {
	return /^win/.test(process.platform);
}

function isInt(value: any): boolean {
	return (value.toString().match(/^[0-9]+$/) !== null)
}

function isFloat(n: any): boolean {
	let x = parseFloat(n)
	return !isNaN(x) ;
}
function isEmpty(object: any) {
  for (var prop in object) {
    if (object.hasOwnProperty(prop)) return false;
  }

  return true;
}

function getIpClient(req: express.Request): string {
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

function decodeBase64(str: string) {

	return new Buffer(str, 'base64').toString()
}

function replaceEnvVars(v: string): string {
	if (typeof v === 'string') {
		Object.keys(process.env).forEach( (k) => {
			let value = process.env[k];
			v = v.replace('%' + k + '%', value);
			v = v.replace('${' + k + '}', value);
		})
	}
	return v;
}

function array_replace_recursive(arr1: any, arr2: any): any {
	let retObj = {},
	i = 0,
	argl = arguments.length;

	if (argl < 2) {
		throw new Error('There should be at least 2 arguments passed to array_replace_recursive()');
	}

	// Although docs state that the arguments are passed in by reference, it seems they are not altered,
	// but rather the copy that is returned (just guessing), so we make a copy here, instead of acting on arr itself
	Object.keys(arr1).forEach( (k ) => {
		retObj[k] = arr1[k];
	})

	for (let k in arr2) {
		if (retObj[k] && typeof retObj[k] === 'object') {
			retObj[k] = this.array_replace_recursive(retObj[k], arr2[i][k]);
		} else {
			retObj[k] = arr2[k];
		}
	}

	return retObj;
}

function getDateFromTimestamp(d: Date) {

	let r: string = d.getFullYear().toString() + '-';

	let month: number = d.getMonth() + 1;
	if (month < 10) {
		r += '0' + month;
	} else {
		r += month;
	}
	r += '-'

	let day: number = d.getDate();
	if (day < 10) {
		r += '0' + day;
	} else {
		r += day;
	}
	r += ' '


	let hour: number = d.getHours();
	if (hour < 10) {
		r += '0' + hour;
	} else {
		r += hour;
	}
	r += ':'

	let min: number = d.getMinutes();
	if (min < 10) {
		r += '0' + min;
	} else {
		r += min;
	}
	r += ':'

	let sec: number = d.getSeconds();
	if (sec < 10) {
		r += '0' + sec;
	} else {
		r += sec
	}

	return r;
}


function parseParams(params: any, fields: any, isBodyParams = true) {

	// !! throw HttpError but can be used outside http context

	let r: any = {}

	Object.keys(fields).forEach( (fieldName) => {

		if (!(r instanceof Error)) {
			let field = fields[fieldName]


			if (typeof params[fieldName] === 'undefined' ) {
				if ( typeof field.default === 'undefined') {
					throw new Errors.BadRequest('param \'' + fieldName + '\' is missing');
				} else {
					r[fieldName] = field.default
				}
			} else {

				let value: any = params[fieldName] as string

				if (field.type === 'boolean') {

					if (['true', 'false', '1', '0', true, false].indexOf( value ) === -1) {
						throw new Errors.BadRequest('wrong value \''+value+'\' for ' + fieldName + ': boolean expected (1, 0, true, false)');
					}
					r[fieldName] = ((value === '1') || (value === 'true') || (value === true))

				} else if (field.type === 'integer') {
					if (!isInt(value)) {
						throw new Errors.BadRequest('wrong value \''+value+'\' for \'' + fieldName + '\' param: integer expected');
					}
					r[fieldName] = parseInt(value, 10)
				} else if (field.type === 'float') {
					if (!isFloat(value)) {
						throw new Errors.BadRequest('wrong value \''+value+'\' for \'' + fieldName + '\' param: float expected');
					}
					r[fieldName] = parseFloat(value)
				} else if (field.type === 'array') {
					try {
						if (!isBodyParams) {
							value = JSON.parse(value)
						}
					} catch (err) {
						throw new Errors.BadRequest(err.toString())
					}
					if (!_.isArray(value)) {
						throw new Errors.BadRequest('wrong value \''+value+'\' for \'' + fieldName + '\' param: array expected');
					}
					r[fieldName] = value
				} else if (field.type === 'object') {
					try {
						if (!isBodyParams) {
							value = JSON.parse(value)
						}
					} catch (err) {
						throw new Errors.BadRequest(err.toString())
					}
					if ((typeof value !== 'object') || _.isArray(value)) {
						throw new Errors.BadRequest('wrong value \''+value+'\' for \'' + fieldName + '\' param: object expected');
					}
					r[fieldName] = value
				} else {
					r[fieldName] = value
				}
			}
		}

	})

	return r
}

function round(v: number, digits = 3) {
	let c = Math.pow(10, digits)
	return Math.round(v * c) / c
}
export {
	round,
	getDateFromTimestamp,
	isInt,
	isFloat,
	Timer,
	randomBetween,
	getIpClient,
	decodeBase64,
	replaceEnvVars,
	array_replace_recursive,
	isWin,
	parseParams,
	shuffleArray,
	md5,
	isEmpty
};
