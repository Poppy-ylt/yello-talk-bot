@echo off
setlocal
cd /d "%~dp0"

where cl.exe >nul 2>&1
if errorlevel 1 (
  echo Run this script from an x64 Native Tools Command Prompt for Visual Studio. 1>&2
  exit /b 1
)
if not defined GME_SDK_INCLUDE set "GME_SDK_INCLUDE=%~dp0vendor-sdk\include"
if not defined GME_SDK_LIBRARY set "GME_SDK_LIBRARY=%~dp0vendor-sdk\lib\gmesdk.lib"
set "SDK_BIN=%~dp0vendor-sdk\bin"
if not defined GME_SDK_INCLUDE (
  echo GME SDK include directory is not configured. 1>&2
  exit /b 1
)
if not defined GME_SDK_LIBRARY (
  echo GME SDK import library is not configured. 1>&2
  exit /b 1
)
if not exist "%GME_SDK_INCLUDE%\tmg_sdk.h" (
  echo GME SDK header not found under GME_SDK_INCLUDE. 1>&2
  exit /b 1
)
if not exist "%GME_SDK_LIBRARY%" (
  echo GME SDK library not found at GME_SDK_LIBRARY. 1>&2
  exit /b 1
)
if not exist "%SDK_BIN%\gmesdk.dll" (
  echo Bundled GME runtime DLLs not found under "%SDK_BIN%". 1>&2
  exit /b 1
)

if not exist build mkdir build
set "OUTPUT=%~1"
if not defined OUTPUT set "OUTPUT=build\gme-music-bot-windows.exe"
for %%I in ("%OUTPUT%") do set "OUTPUT_DIR=%%~dpI"
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"
set "OBJECT=%TEMP%\gme-music-bot-windows-%RANDOM%-%RANDOM%.obj"
if exist "%OBJECT%" (
  echo Temporary object path already exists; refusing to overwrite it. 1>&2
  exit /b 1
)

cl.exe /nologo /std:c++17 /EHsc /O2 /MT /I"%GME_SDK_INCLUDE%" /Fo"%OBJECT%" main_windows.cpp /link /OUT:"%OUTPUT%" "%GME_SDK_LIBRARY%" ws2_32.lib winhttp.lib ole32.lib uuid.lib
if errorlevel 1 goto :build_failed
copy /Y "%SDK_BIN%\*.dll" "%OUTPUT_DIR%" >nul
if errorlevel 1 goto :build_failed
if exist "%OBJECT%" del /q "%OBJECT%" >nul 2>&1

echo Built %OUTPUT% with bundled GME runtime DLLs in %OUTPUT_DIR%
exit /b 0

:build_failed
set "BUILD_EXIT=%errorlevel%"
if exist "%OBJECT%" del /q "%OBJECT%" >nul 2>&1
exit /b %BUILD_EXIT%
