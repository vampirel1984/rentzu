@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d D:\apps\rentzu

echo [rentzu-server] cleaning old server on port 8000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
  taskkill /PID %%a /T /F >nul 2>&1
)

echo [rentzu-server] cleaning old run-server cmd windows...
for /f "skip=1 tokens=2 delims=," %%a in ('wmic process where "name='cmd.exe' and commandline like '%%run-server.cmd%%'" get processid^,commandline /format:csv 2^>nul') do (
  if not "%%~a"=="" (
    taskkill /PID %%~a /T /F >nul 2>&1
  )
)

echo [rentzu-server] cleaning old uvicorn python processes...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$targets = Get-CimInstance Win32_Process | Where-Object { ($_.Name -in @('python.exe','pythonw.exe')) -and ($_.CommandLine -match 'uvicorn' -or $_.CommandLine -match 'D:\\apps\\rentzu\\server') }; foreach ($p in $targets) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {} }"

for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
  if not "%%A"=="" if not "%%A:~0,1"=="#" set "%%A=%%B"
)
echo SMTP_HOST=%SMTP_HOST%
echo SMTP_USER=%SMTP_USER%
call .venv\Scripts\activate
cd /d D:\apps\rentzu\server\src
echo [rentzu-server] starting uvicorn on 8000...
python -m uvicorn main:app --host 0.0.0.0 --port 8000
