
@echo off
Set /P nomService=Entrez le nom du service || Set nomService=NothingChosen
If "%nomService%"=="NothingChosen" goto sub_error

cd /d %~dp0%

mkdir ..\logs
mkdir ..\tmp

echo %nomService%

agent.exe install %nomService% "%CD%\agent.bat"

sc start %nomService%

goto:eof

:sub_error
echo ACTION ABANDONNEE

pause