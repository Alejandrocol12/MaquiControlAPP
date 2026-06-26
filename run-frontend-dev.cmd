@echo off
cd /d "%~dp0frontend"
set BROWSER=none
npm.cmd start > "%~dp0frontend-dev.log" 2> "%~dp0frontend-dev.err"
