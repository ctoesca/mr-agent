set SCRIPT_DIR=%~dp0
set DIR=%SCRIPT_DIR%..

cd %DIR%

SET PATH=%PATH%;node_modules\.bin;node

tslint --fix --project tslint.json src/**/**.ts 

pause