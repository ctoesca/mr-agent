echo off
set SCRIPT_DIR=%~dp0
set DIR=%SCRIPT_DIR%\..

set PATH=%DIR%\node;%DIR%\node_modules\.bin;%PATH%

node -v

del %DIR%\logs\tests.log

cd %DIR%

 %DIR%\node\npm run test-with-coverage > %DIR%\logs\tests.log


pause
