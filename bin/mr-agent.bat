@echo off

SETLOCAL


set SCRIPT_DIR=%~dp0
set DIR=%SCRIPT_DIR%..

TITLE MR-agent

SET NODE_PATH=%DIR%\src
SET PATH=node_modules\.bin;node;%PATH%
set OPENSSL_CONF=%DIR%/conf/openssl.cnf

cd /d %DIR%

node -v

supervisor -pid tmp/PID.txt -w dist,conf -e js,yml dist/starter > nul

:finally

ENDLOCAL
