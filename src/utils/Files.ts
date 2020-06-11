

import fs = require('fs-extra')
import mime = require('mime')
import * as utils from '../utils'
import * as Promise from 'bluebird'
import './StringTools';
// import {ChildProcess} from "./ChildProcess";

export class Files {

	public static getFilePart(path: string, blocNum: number, blocksize = 1024*1024*1024){
		
		try{
			let opt = {
				start: blocNum * blocksize,
				end: blocNum * blocksize + blocksize - 1
			}

			let size: number = fs.statSync(path).size

			if (opt.start >= size)
			{
				throw "start ("+opt.start+") >= filesize ("+size+')';			
			}
			
			if (opt.end > size)
			{
				opt.end = size
			}

			if (opt.start >= opt.end){
				throw "start ("+opt.start+") >= end ("+size+')';	
			}


			let readStream: fs.ReadStream = fs.createReadStream(path,opt)

			return Promise.resolve({
				stream: readStream,
				start: opt.start,
				end: opt.end,
				totalSize: size
			})

		}catch(err){
			return Promise.reject(err)
		}

	}

	public static mergeFiles(files: string[], destPath: string, deletePartsOnSuccess = true)
	{
		return new Promise( (resolve: Function, reject: Function)  => {

			try{

				let writeStream: fs.WriteStream = fs.createWriteStream(destPath)
				
				console.log("Creation stream "+destPath)

				return Promise.each( files, (file) => {
					return this.appendFileToStream(file, writeStream)
				})
				.then( (results) => {

					for (let file of files)
						fs.unlinkSync(file)

					resolve({
					   	files: files,
					    destPath: destPath
					})
				})
				.finally(() =>{ 
					writeStream.close()
				})

			}catch(err){
				reject(err)
			}

		})
	}

	private static appendFileToStream(path: string, stream: fs.WriteStream){

		return new Promise( (resolve: Function, reject: Function)  => {

			fs.createReadStream(path)
			.on('error', function (err) {	 
			    reject(err)
			})
			.on('end', function () {
			})
			.on('close', function () {
				console.log("appendFileToStream success "+path)
				resolve()
			})
			.on('data', function (chunk) {
  				stream.write(chunk)
			})
			
		})
	}

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
