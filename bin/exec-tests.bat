echo off
set SCRIPT_DIR=%~dp0
set DIR=%SCRIPT_DIR%\..

set PATH=%DIR%\node;%DIR%\node_modules\.bin;%PATH%

node -v

del %DIR%\logs\tests.log

node %DIR%\test\test-app.js > %DIR%\logs\tests.log


pause
