const assert = require('assert');
//const request = require('request')
const request = require('request-promise')
const simpleRequest = require('request')
const fs = require('fs-extra');
const expect = require('Chai').expect;
const _ = require('lodash')


var tmpDir = __dirname+"/../../tmp"
var sourceDir = __dirname+"/../../dist"
var sourceFile = __dirname+"/../../dist/index.js"
var sourceFileName = "index.js"

describe('GET /_plugin/filesystem', function() {

		it('should return 404', function (done) {
			let opt = getHttpOptions('GET', '/_plugin/filesystem')
			execRequestExpectError(opt, done, 404)
		});

});

describe('/_plugin/filesystem/moveFile', function() 
{

	describe('POST /moveFile no path', function() {

		it('should return 400', function (done) {
			let dest = tmpDir
			let opt = getHttpOptions('POST', '/_plugin/filesystem/moveFile')
			opt.body = {
				dest: dest
			}
			execRequestExpectError(opt, done, 400)
			
		});

	});

	describe('POST /moveFile to directory', function() {

		it('should return 400 - dest is directory', function (done) {
			let source = sourceFile
			let dest = tmpDir
			let opt = getHttpOptions('POST', '/_plugin/filesystem/moveFile')
			opt.body = {
				path: source,
				dest: dest
			}
			execRequestExpectError(opt, done, 400)
		});

	});

	describe('POST /moveFile path does not exists', function() {

		it('should return error - path does not exists', function (done) {
			let source = sourceDir+'/blablabla'
			let dest = tmpDir+'/blablabla'
			let opt = getHttpOptions('POST', '/_plugin/filesystem/moveFile')
			opt.body = {
				path: source,
				dest: dest
			}
			execRequestExpectError(opt, done, 400)
		});

	});

	describe('POST /moveFile dest directory does not exists', function() {

		it('should return error', function (done) {
			let source = sourceFile
			let dest = tmpDir+'/blablabla/index.txt'
			if (fs.pathExistsSync(tmpDir+'/blablabla'))
				fs.removeSync(tmpDir+'/blablabla')
			
			let opt = getHttpOptions('POST', '/_plugin/filesystem/moveFile')
			opt.body = {
				path: source,
				dest: dest
			}
			execRequestExpectError(opt, done, 500)
		});

	});

	describe('POST /moveFile path='+tmpDir+'/test.txt', function() {

		it('should return 200', function (done) {
			let source = tmpDir+'/test.txt'
			let dest = tmpDir+'/testMoved.txt'
			fs.writeFileSync(source, 'test')
			if (fs.pathExistsSync(dest))
				fs.unlinkSync(dest)

			let opt = getHttpOptions('POST', '/_plugin/filesystem/moveFile')
			opt.body = {
				path: source,
				dest: dest
			}

			request( opt )
			.then( (res) => {	
				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(res.body.result, true);
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

	describe('POST /moveFile - dest already exists', function() {

		it('should return 400', function (done) {
			let source = tmpDir+'/test.txt'
			let dest = tmpDir+'/testMoved.txt'
			fs.writeFileSync(source, 'test')

			let opt = getHttpOptions('POST', '/_plugin/filesystem/moveFile')
			opt.body = {
				path: source,
				dest: dest
			}

			execRequestExpectError(opt, done, 400)
		});

	});

	describe('POST /moveFile source is directory', function() {

		it('should return error - source is directory', function (done) {
			let source = tmpDir
			let dest = tmpDir+'/testMoved.txt'
			if (fs.pathExistsSync(dest))
				fs.unlinkSync(dest)

			let opt = getHttpOptions('POST', '/_plugin/filesystem/moveFile')
			opt.body = {
				path: source,
				dest: dest
			}

			execRequestExpectError(opt, done, 400)
		});

	});

})



describe('/_plugin/filesystem/copyFile', function() 
{
		
	describe('POST /copyFile dest is directory', function() {

		it('should return 400', function (done) {
			let source = sourceFile
			let dest = tmpDir
			let opt = getHttpOptions('POST', '/_plugin/filesystem/copyFile')
			opt.body = {
				path: source,
				dest: dest
			}

			execRequestExpectError(opt, done, 400)
		});

	});

	describe('POST /copyFile dest already exists', function() {

		it('should return 200', function (done) {
			let source = sourceFile
			let dest = tmpDir+'/index.txt'
			if (!fs.pathExistsSync(dest))
				fs.writeFileSync(dest, 'test')

			let opt = getHttpOptions('POST', '/_plugin/filesystem/copyFile')
			opt.body = {
				path: source,
				dest: dest
			}

			request( opt )
			.then( (res) => {	
				assert.strictEqual(res.statusCode, 200);			
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

	describe('POST /copyFile path does not exists', function() {

		it('should return error', function (done) {
			let source = sourceDir+'/blablabla'
			let dest = tmpDir+'/blablabla'
			let opt = getHttpOptions('POST', '/_plugin/filesystem/copyFile')
			opt.body = {
				path: source,
				dest: dest
			}

			execRequestExpectError(opt, done, 400)
		});

	});

	describe('POST /copyFile dest directory does not exists', function() {

		it('should return 200', function (done) {
			let source = sourceFile
			let dest = tmpDir+'/blablabla/index.txt'
			if (fs.pathExistsSync(tmpDir+'/blablabla'))
				fs.removeSync(tmpDir+'/blablabla')

			let opt = getHttpOptions('POST', '/_plugin/filesystem/copyFile')
			opt.body = {
				path: source,
				dest: dest
			}

			request( opt )
			.then( (res) => {	
				if (fs.pathExistsSync(__dirname+'/blablabla'))
					fs.removeSync(__dirname+'/blablabla')

				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual( fs.pathExistsSync(dest), true);
				
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

	describe('POST /copyFile path='+sourceFile, function() {

		it('should return 200', function (done) {
			let source = sourceFile
			let dest = tmpDir+'/index.txt'
			let opt = getHttpOptions('POST', '/_plugin/filesystem/copyFile')
			opt.body = {
				path: source,
				dest: dest
			}

			request( opt )
			.then( (res) => {	
				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(res.body.result, true);
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});


	describe('POST /copyFile source is directory', function() {

		it('should return error - source is directory', function (done) {
			let source = tmpDir
			let dest = tmpDir+'/testMoved.txt'
		
			let opt = getHttpOptions('POST', '/_plugin/filesystem/copyFile')
			opt.body = {
				path: source,
				dest: dest
			}

			execRequestExpectError(opt, done, 400)
		});

	});

})


describe('/_plugin/filesystem/fileinfo', function() 
{
		
	describe('GET /fileinfo path='+sourceFile, function() {

		it('should return 200', function (done) {
			
			let opt = getHttpOptions('GET', '/_plugin/filesystem/fileinfo?path='+sourceFile)
			
			request( opt )
			.then( (res) => {	

				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(res.body.name, 'index.js');
				assert.strictEqual(res.body.contentType.contains('application/javascript'), true);
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});


	describe('GET /fileinfo path=blablabla', function() {

		it('should return error', function (done) {
			
			let opt = getHttpOptions('GET', '/_plugin/filesystem/fileinfo?path=blablabla')
			
			execRequestExpectError(opt, done, 500)
		});

	});

	describe('GET /fileinfo', function() {

		it('should return 400', function (done) {
			
			let opt = getHttpOptions('GET', '/_plugin/filesystem/fileinfo')
			
			execRequestExpectError(opt, done, 400)
		});

	});

})



describe('/_plugin/filesystem/fileExists', function() 
{
		
	describe('GET /fileExists path='+sourceFile, function() {

		it('should return 200', function (done) {
			
			let opt = getHttpOptions('GET', '/_plugin/filesystem/fileExists?path='+sourceFile)
			
			request( opt )
			.then( (res) => {	
				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(res.body.result, true);
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});


	describe('GET /fileExists path=blablabla', function() {

		it('should return error', function (done) {
			
			let opt = getHttpOptions('GET', '/_plugin/filesystem/fileExists?path=blablabla')
			
			request( opt )
			.then( (res) => {	
				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(res.body.result, false);
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

	describe('GET /fileExists', function() {

		it('should return 400', function (done) {
			
			let opt = getHttpOptions('GET', '/_plugin/filesystem/fileExists')
			
			execRequestExpectError(opt, done, 400)
		});

	});

})



describe('/_plugin/filesystem/execScript', function() 
{
		
	describe('POST execScript type=shell', function() {

		it('should return 200', function (done) {
			
			let opt = getHttpOptions('POST', '/_plugin/filesystem/execScript')
			opt.body = {
				script: "dir"
			}

			request( opt )
			.then( (res) => {	
				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(res.body.exitCode, 0);
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

	describe('POST execScript type=blabla', function() {

		it('should return error 400', function (done) {
			
			let opt = getHttpOptions('POST', '/_plugin/filesystem/execScript')
			opt.body = {
				script: "dir",
				type: 'blabla'
			}

			execRequestExpectError(opt, done, 412)
		});

	});


	describe('POST execScript type=javascript with result', function() {

		it('should return 200', function (done) {
			
			let opt = getHttpOptions('POST', '/_plugin/filesystem/execScript')
			opt.body = {
				script: "result = 2*2",
				type: 'javascript'
			}

			request( opt )
			.then( (res) => {	
				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(res.body.stdout, 4);
				assert.strictEqual(res.body.exitCode, 0);
				done();				
			})
			.catch( err => {

				done(err)
			})
		});

	});


	describe('POST execScript type=javascript with result && exitCode', function() {

		it('should return 200', function (done) {
			
			let opt = getHttpOptions('POST', '/_plugin/filesystem/execScript')
			opt.body = {
				script: "result = 2*2\nexitCode=2",
				type: 'javascript'
			}

			request( opt )
			.then( (res) => {	
	
				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(res.body.stdout, 4);
				assert.strictEqual(res.body.exitCode, 2);
				done();				
			})
			.catch( err => {

				done(err)
			})
		});

	});


	describe('POST execScript type=javascript with syntax error', function() {

		it('should return 500', function (done) {
			
			let opt = getHttpOptions('POST', '/_plugin/filesystem/execScript')
			opt.body = {
				script: "blabla",
				type: 'javascript'
			}

			execRequestExpectError(opt, done, 500)
		});

	});

})

describe('/_plugin/filesystem/writeTextFile', function() 
{
	describe('POST /_plugin/filesystem/writeTextFile', function() {

		it('should return 200', function (done) {
				
			let opt = getHttpOptions('POST', '/_plugin/filesystem/writeTextFile')
			opt.body = {
				path: tmpDir+"/writeTextFile.txt",
				content: 'test'
			}

			request( opt )
			.then( (res) => {	
		
				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(typeof res.body.path, 'string');
				assert.strictEqual(res.body.result, true);
				done();				
			})
			.catch( err => {

				done(err)
			})
		});
	})

	describe('POST writeTextFile, path does not exist', function() {

		it('should return 500', function (done) {
				
			let opt = getHttpOptions('POST', '/_plugin/filesystem/writeTextFile')
			opt.body = {
				path: tmpDir+"/blabla/writeTextFile.txt",
				content: 'test'
			}

			execRequestExpectError(opt, done, 500)
		});
	})

})

describe('/_plugin/filesystem/list', function() 
{
		
	describe('GET path='+sourceDir, function() {

		it('should return file list', function (done) {
			
			var query = 'path='+sourceDir
			request( getHttpOptions('GET', '/_plugin/filesystem/list?'+query) )
			.then( (res) => {	
				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(typeof res.body.files, 'object');
				assert.strictEqual(typeof res.body.files.push, 'function');
				assert.strictEqual(res.body.total, 23);
				assert.strictEqual(res.body.files.length, 23);
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

	describe('GET recursive=true&path='+sourceDir, function() {

		it('should return file list', function (done) {
			var query = 'recursive=true&path='+sourceDir
			request( getHttpOptions('GET', '/_plugin/filesystem/list?'+query) )
			.then( (res) => {	
				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(typeof res.body.files, 'object');
				assert.strictEqual(typeof res.body.files.push, 'function');
				assert.strictEqual(res.body.total, 221);
				assert.strictEqual(res.body.files.length, 221);
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});


	describe('GET recursive=true&filter=*.js&path='+sourceDir, function() {

		it('should return file list', function (done) {
			var query = 'recursive=true&filter=*.js&path='+sourceDir
			request( getHttpOptions('GET', '/_plugin/filesystem/list?'+query) )
			.then( (res) => {	
				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(typeof res.body.files, 'object');
				assert.strictEqual(typeof res.body.files.push, 'function');
				assert.strictEqual(res.body.total, 65);
				assert.strictEqual(res.body.files.length, 65);
				done();				
			})
			.catch( err => {
				done(err)
			})
		});

	});

	describe('GET recursive=true&maxResults=10&filter=*.ts&path='+sourceDir, function() {

		it('should return file list', function (done) {		
			var query = 'recursive=true&maxResults=10&filter=*.ts&path='+sourceDir
			request( getHttpOptions('GET', '/_plugin/filesystem/list?'+query) )
			.then( (res) => {	
				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(typeof res.body.files, 'object');
				assert.strictEqual(typeof res.body.files.push, 'function');
				assert.strictEqual(res.body.total, 65);
				assert.strictEqual(res.body.files.length, 10);
				done();				
			})
			.catch( err => {

				done(err)
			})
		});

	});


	describe('GET recursive=true&path=/blablabla', function() {

		it('should return error', function (done) {
			var query = 'recursive=true&path=/blablabla'
			let opt = getHttpOptions('GET', '/_plugin/filesystem/list?'+query)
			execRequestExpectError(opt, done, 500)
		});

	});

});





describe('/_plugin/filesystem/upload', function() {

	describe('upload file', function() {

		it('should return 200', function (done) {
		
			let path = tmpDir+'/upload.txt'
			if (fs.pathExistsSync(path))
				fs.unlinkSync(path)

			let opt = getHttpOptions('POST', '/_plugin/filesystem/upload?path='+path)
			
			opt.formData = {
		        // Like <input type="text" name="name">
		        name: sourceFileName,
		        // Like <input type="file" name="file">
		        file1: {
		            value: fs.createReadStream(sourceFile),
		            options: {
		                filename: sourceFileName,
		                contentType: 'application/javascript'
		            }
		        },
		        file2: {
		            value: fs.createReadStream(sourceDir+'/Application.js'),
		            options: {
		                filename: 'Application.js',
		                contentType: 'application/javascript'
		            }
		        }
		    },
					
			request( opt )
			.then( (res) => {	

				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual(typeof res.body, 'object', 'body is not object');
				assert.strictEqual(typeof res.body.file, 'object', 'body.file is not object');
				assert.strictEqual(res.body.path, path, 'body[0].path != '+path);
				assert.strictEqual(fs.pathExistsSync(path), true, 'uploaded file does not exists');
				done();				
			})
			.catch( err => {

				done(err)
			})
		})
	})

	describe('upload no file', function() {

		it('should return error', function (done) {
		
			let path = tmpDir+'/upload2.txt'
			if (fs.pathExistsSync(path))
				fs.unlinkSync(path)

			let opt = getHttpOptions('POST', '/_plugin/filesystem/upload?path='+path)
			
			opt.formData = {
		        name: sourceFileName,
		    },
					
			execRequestExpectError(opt, done, 400)
		})
	})

	describe('upload file - dest is directory', function() {

		it('should return 400 (dest is a directory)', function (done) {
		
			let path = tmpDir

			let opt = getHttpOptions('POST', '/_plugin/filesystem/upload?path='+path)
			
			opt.formData = {
		        // Like <input type="text" name="name">
		        name: sourceFileName,
		        // Like <input type="file" name="file">
		        file: {
		            value: fs.createReadStream(sourceFile),
		            options: {
		                filename: sourceFileName,
		                contentType: 'application/javascript'
		            }
		        }
		    },
					
			execRequestExpectError(opt, done, 400)
		})
	})

	describe('upload file - dest directory does not exist', function() {

		it('should return 400 (dest a directory does not exist)', function (done) {
		
			let path = tmpDir+'/uploadblablabla/upload.txt'

			let opt = getHttpOptions('POST', '/_plugin/filesystem/upload?path='+path)
			
			opt.formData = {
		        // Like <input type="text" name="name">
		        name: sourceFileName,
		        // Like <input type="file" name="file">
		        file: {
		            value: fs.createReadStream(sourceFile),
		            options: {
		                filename: sourceFileName,
		                contentType: 'application/javascript'
		            }
		        }
		    },
					
			execRequestExpectError(opt, done, 400)
		})
	})


	describe('upload existing file - overwrite=false', function() {

		it('should return error', function (done) {
		
			let path = tmpDir+'/upload.txt'
			let opt = getHttpOptions('POST', '/_plugin/filesystem/upload?path='+path+'&overwrite=false')
			
			opt.formData = {
		        // Like <input type="text" name="name">
		        name: sourceFileName,
		        // Like <input type="file" name="file">
		        file: {
		            value: fs.createReadStream(sourceFile),
		            options: {
		                filename: sourceFileName,
		                contentType: 'application/javascript'
		            }
		        }
		    },
					
			execRequestExpectError(opt, done, 400)
		})
	})

})


describe('/_plugin/filesystem/deleteFiles', function() {

	describe('delete existing file', function() {

		it('should return 200', function (done) {
			
			let path = tmpDir+'/fileToDelete.txt'
			
			let opt = getHttpOptions('POST', '/_plugin/filesystem/deleteFiles')
			opt.body = {
				path: path
			}
			fs.writeFileSync(path, 'test')
		
			request( opt )
			.then( (res) => {	
			
				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual(typeof res.body, 'object');
				assert.strictEqual(fs.pathExistsSync(path), false);
				assert.strictEqual(res.body.result, true);
				assert.strictEqual(typeof res.body.filename, 'string');
				assert.strictEqual(res.body.path, path);

				done();				
			})
			.catch( err => {
				done(err)
			})
		})
	})


	describe('delete not existing file', function() {

		it('should return 404', function (done) {
			
			let path = tmpDir+'/fileToDelete.txt'
			
			let opt = getHttpOptions('POST', '/_plugin/filesystem/deleteFiles')
			opt.body = {
				path: path
			}
			if (fs.pathExistsSync(path))
				fs.unlinkSync(path)
		
			execRequestExpectError(opt, done, 404)
		})
	})
})


describe('/_plugin/filesystem/download', function() 
{
	describe('Download existing file', function() {

		it('should return 200', function (done) {
			
			let query = 'path='+sourceFile
			let opt = getHttpOptions('GET', '/_plugin/filesystem/download?'+query)
			opt.json = false

			request( opt )
			.then( (res) => {	
				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual(typeof res.body, 'string');
				assert.strictEqual(res.headers['content-type'], 'application/zip');
				assert.strictEqual(res.headers['content-disposition'], 'attachment; filename="index.js.zip"');
				done();				
			})
			.catch( err => {
				done(err)
			})
		});
	})

	describe('Download existing file - compress=false', function() {

		it('should return 200', function (done) {
			
			let query = 'path='+sourceFile+'&compress=false'
			let opt = getHttpOptions('GET', '/_plugin/filesystem/download?'+query)
			opt.json = false

			request( opt )
			.then( (res) => {	
				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual(typeof res.body, 'string');
				/*assert.strictEqual(res.headers['content-type'], 'application/javascript');
				assert.strictEqual(res.headers['content-disposition'], 'attachment; filename="index.js"');*/
				done();				
			})
			.catch( err => {
				done(err)
			})
		});
	})

	describe('Download file - file does not exists', function() {

		it('should return 404', function (done) {
			
			let query = 'path='+sourceFile+'/balbalba'
			let opt = getHttpOptions('GET', '/_plugin/filesystem/download?'+query)
			execRequestExpectError(opt, done, 404)
		});
	})

	describe('Download directory', function() {

		it('should return 200', function (done) {
			
			let query = 'path='+sourceDir
			let dest = tmpDir+'/downloadZip.zip'
			let opt = getHttpOptions('GET', '/_plugin/filesystem/download?'+query)
			opt.json = false
			if (fs.pathExistsSync(dest))
				fs.unlinkSync(dest)

			let destFileStream = fs.createWriteStream(dest);

			request( opt , (error, res, body) => {
				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual(typeof res.body, 'string');
				assert.strictEqual(res.headers['content-type'], 'application/zip');
				assert.strictEqual(res.headers['content-disposition'], 'attachment; filename="dist.zip"');		
			})
			.pipe(destFileStream)
		    .on('finish', () => {

		    	if (fs.pathExistsSync(dest) && (fs.statSync(dest).size > 0))
		       		done();		 	      
		       	else
		       		done('Downloaded file does not exists or is empty');		 	      
		    })
		    .on('error', (error) => {
		        done(error);
		    })


		});
	})

})