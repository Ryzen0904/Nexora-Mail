@echo off
title Nexora-Mail — Serveur local
echo.
echo   ============================================
echo     Nexora-Mail — Démarrage du serveur local
echo   ============================================
echo.
cd /d "%~dp0"

echo   [1/3] Vérification de Node.js...
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [!] Node.js n'est pas installé ou introuvable.
  echo       Installez-le sur https://nodejs.org puis réessayez.
  echo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do set NODEVER=%%v
echo        Node.js %NODEVER% détecté
echo.
echo   [2/3] Vérification du port 3000...
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo        Port 3000 déjà utilisé — un serveur tourne peut-être déjà.
  echo        Ouvrez simplement http://localhost:3000
  echo.
  start "" "http://localhost:3000"
  exit /b 0
)
echo        Port 3000 libre
echo.
echo   [3/3] Lancement du serveur...
echo        -> http://localhost:3000
echo        (Fermez cette fenêtre pour ARRÊTER le serveur)
echo.
start "" "http://localhost:3000"
node server.js
pause