

import fs = require('fs-extra')
import mime = require('mime')
import * as utils from '../utils'
import * as Promise from 'bluebird'
import './StringTools';
//import {ChildProcess} from "./ChildProcess";

export class Files {
	
	public static isDir(path: string) {
		return new Promise( (resolve, reject) => {
			fs.stat(path, (err, stats) => {
				if (err) {
					reject(err)
				} else {
					resolve(stats.isDirectory())
				}
			})
		})
	}

	/*public static shellMoveFile(source: string, dest: string, opt: any = {}): any {
    	
    	let params: any = utils.parseParams(opt, {
			overwrite: {
				type: 'boolean',
				default: true
			}
		})

    	let args: string[] = []
    	if (params.overwrite)
    		args.push( '/Y'	)
    	args.push(source)
    	args.push(dest)

        return ChildProcess.execCmd('copy', args)
        .then( (result: any) => {
        	if (result.exitCode !== 0){
        		
        		if (result.stderr != '')
        			return result.stderr
        		else if (result.stdout != '')
        			throw result.stdout
        		else
        			throw 'copy error - exitCode='+result.exitCode
        	}
        	else{
        		return result
        	}
        })
    }*/

	public static getFileName(path: string) {
		return require('path').basename(path);

	}

	public static getFileSize(path: string) {
		let stats = fs.statSync(path)
		return stats.size
	}

	public static getFileStat(path: string, includeMime = false): any {
		// path = path.replace(/\\/g, "/")
		// path = path.replace(/\/+/g, "/")

		let fileStat = fs.lstatSync(path);
		let name = Files.getFileName(path);

		let r: any = {
			name: name,
			path: path,
			date: utils.getDateFromTimestamp( fileStat.mtime ),
			size: fileStat.size,
			isFile: (fileStat.isFile()),
			isDir: (fileStat.isDirectory()),
			isLink: (fileStat.isSymbolicLink())
		};

		if (includeMime && !r.isDir && !r.isLink) {
			r.contentType = mime.getType(path);
			if (r.contentType) {
				r.contentSubType = r.contentType.leftOf('/');
			}
		}

		return r;

	}
}
