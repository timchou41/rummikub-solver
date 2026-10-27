@echo off
chcp 65001 >nul
title 拉密神助手 - Rummikub AI Solver

echo =========================================================
echo       🀄 拉密神助手 (Rummikub AI Solver) 啟動中...
echo =========================================================
echo.

cd /d "%~dp0"
python app.py

pause
