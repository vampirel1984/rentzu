@echo off
setlocal EnableExtensions
cd /d D:\apps\rentzu\app
echo [rentzu-ui] starting Expo on 8081...
call npx expo start -c --port 8081
