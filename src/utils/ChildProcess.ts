
import * as Promise from 'bluebird'
import * as child_process from 'child_process'
import './StringTools';

export class ChildProcess {

	public static spawnCmd(cmd: string, args: string[]) {
    
        return new Promise((resolve, reject) => {

            var argsArray = [ '/C' , cmd].concat(args)
            var stdout = ''
            var stderr = ''

            let child = child_process.spawn('cmd', argsArray, {
            });

            child.on('close', (code) => {
                
                var r = {
                    exitCode: code,
                    stdout: stdout,
                    stderr: stderr
                }

                resolve(r)
                
            });

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('error', (error) => {
                reject(error);
            });
        })    
    }

    public static execCmd(cmd: string, args: string[]) {
    
        return new Promise((resolve, reject) => {

          	var argsStr: string = ''
          	if (args.length > 0)
          		argsStr = '"' + args.join('" "')+'"'

            child_process.exec('"'+cmd+'"' + ' '+argsStr, (error, stdout, stderr) => {

            	let exitCode = 0
            	if (error)
            		exitCode = error.code
            	
            	var r = {
                    exitCode: exitCode,
                    stdout: stdout,
                    stderr: stderr
                }

                resolve(r)

            });

        })    
    }

}
