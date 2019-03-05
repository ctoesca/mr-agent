#!/bin/bash

DIR=$(dirname $(readlink -f "$0"))
cd $DIR/..
DIR=`pwd`

export NODE_PATH=$DIR/dist
export PATH=$DIR/node:$DIR/node_modules/.bin:$PATH
export OPENSSL_CONF=$DIR/conf/openssl.cnf

version() {
    nodeVersion=`node -v`
    echo "Node version: $nodeVersion"
}

status() {
       #curl --insecure --fail "https://localhost:3000/api/checkAgent" 1>/dev/null 2>/dev/null
       ps -ef | grep -v grep |  grep "$DIR/dist/index.js" 2>/dev/null 1>/dev/null
       if [  $? -eq 0 ]
       then
          echo "Running"
       else
          echo "Stopped"
       fi
}
start() {
      version
      status=$(status)

      if [ $status != "Running" ]
      then
        #| $DIR/node_modules/.bin/bunyan
        rm -f $DIR/nohup.out
        $DIR/node_modules/.bin/supervisor -pid $DIR/tmp/PID.txt -w $DIR/dist,$DIR/conf -e js,yml -- $DIR/dist/starter.js $@ | bunyan
        sleep 3
        
        status=$(status)

        if [ $status != "Running" ]
        then
              echo "Start failed"
              stop
              exit 1
            else
              echo "CTOP-AGENT started"
            fi
            
        else
            echo "CTOP-AGENT already started"
            exit 0
        fi
}
# Restart the service FOO
stop() {
    version
        PID=`ps -ef | grep $DIR | grep -v grep | awk '{print $2}'`
    kill -9 $PID 2>/dev/null
    sleep 3
    status=$(status)
    if [ $status != "Stopped" ]
    then
      echo "CTOP-AGENT n'a pas pu être stoppé!"
    else
      echo "CTOP-AGENT stopped"
    fi
}
### main logic ###
case "$1" in
  start)
        start
        ;;
  stop)
        stop
        ;;
  status)
        status
        ;;
  restart|reload|condrestart)
        stop
        start
        ;;
  *)
        echo $"Usage: $0 {start|stop|restart|reload|status}"
        exit 1
esac
exit 0

