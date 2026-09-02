@echo off
title Nexora-Mail — Arrêt du serveur
echo.
echo   Arrêt du serveur Nexora-Mail...
taskkill /F /IM node.exe >nul 2>nul
echo.
echo   Serveur arrêté (tous les processus Node fermés).
echo.
pause