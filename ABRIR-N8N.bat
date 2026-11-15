@echo off
chcp 65001 >nul
title n8n - Flujos con IA (no cierres esta ventana mientras lo uses)
cd /d "%~dp0"

rem n8n guarda todo dentro de esta carpeta, en "datos-n8n".
set "N8N_USER_FOLDER=%~dp0datos-n8n"
if "%N8N_PORT%"=="" set "N8N_PORT=5678"
set "GENERIC_TIMEZONE=Europe/Madrid"
set "N8N_DIAGNOSTICS_ENABLED=false"
set "N8N_VERSION_NOTIFICATIONS_ENABLED=false"
set "N8N=n8n@2.42.6"

echo.
echo  ==============================================
echo    n8n - Flujos con IA
echo  ==============================================
echo.

rem 1. Node.js hace falta para n8n. Si no esta, se instala solo.
where node >nul 2>nul
if errorlevel 1 (
  echo  Falta un programa necesario ^(Node.js^). Instalandolo...
  echo  Si Windows pregunta si permites cambios, pulsa "Si".
  echo.
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  echo.
  echo  Listo. Cierra esta ventana y vuelve a hacer doble clic en ABRIR-N8N.
  echo.
  pause
  exit /b
)

rem 2. La primera vez se cargan los flujos.
if not exist "%N8N_USER_FOLDER%\.flujos-cargados" (
  echo  Primera vez: descargando n8n y cargando los flujos.
  echo  Puede tardar entre 5 y 10 minutos. No cierres la ventana.
  echo.
  call npx -y %N8N% import:workflow --separate --input="%~dp0flujos"
  if errorlevel 1 goto fallo
  call npx -y %N8N% import:workflow --separate --input="%~dp0flujos\ensayo-sin-conexion"
  if errorlevel 1 goto fallo
  if not exist "%N8N_USER_FOLDER%" mkdir "%N8N_USER_FOLDER%"
  echo ok> "%N8N_USER_FOLDER%\.flujos-cargados"
  echo.
  echo  Flujos cargados.
)

rem 3. Abrir el navegador cuando n8n este listo.
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "$u='http://localhost:%N8N_PORT%'; for($i=0;$i -lt 300;$i++){ try { Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process $u; break } catch { Start-Sleep 2 } }"

echo.
echo  Arrancando n8n. El navegador se abrira solo en unos segundos.
echo  Si no se abre, entra en: http://localhost:%N8N_PORT%
echo.
echo  Para apagar n8n, cierra esta ventana.
echo.
call npx -y %N8N% start
goto fin

:fallo
echo.
echo  Algo ha fallado. Comprueba que tienes internet y vuelve a intentarlo.
echo  Si sigue fallando, haz una foto de esta ventana y enviasela a tu hermano.
echo.

:fin
pause
