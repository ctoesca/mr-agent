#!/bin/bash

DIR=$(dirname $(readlink -f "$0"))
cd $DIR/..
DIR=`pwd`

export NODE_PATH=$DIR/dist
export PATH=$DIR/node:$DIR/node_modules/.bin:$PATH
export OPENSSL_CONF=$DIR/conf/openssl.cnf

rm $DIR/logs/tests.log

node $DIR/test/test-app.js > $DIR/logs/tests.log

