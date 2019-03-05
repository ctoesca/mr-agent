cd /d %~dp0%


mkdir ..\logs
mkdir ..\tmp

MR-agent.exe install MR-agent "%CD%\MR-agent.bat"

sc start MR-agent
pause