@echo off
setlocal

set "ROOT=%~dp0"
"%ROOT%pocket\pocketbase.exe" %*
