@echo off
Set /P nomService=Entrez le nom du service || Set nomService=NothingChosen
If "%nomService%"=="NothingChosen" goto sub_error

cd /d %~dp0%

sc stop %nomService%
agent.exe remove %nomService%

goto:eof

:sub_error
echo ACTION ABANDONNEE

pause