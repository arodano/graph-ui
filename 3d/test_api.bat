@echo off
echo ============================================
echo TEST DE CONECTIVIDAD A API
echo ============================================

echo.
echo 1. Verificando servidores locales...
echo.

echo Proxy (puerto 3002):
curl -s -o nul -w "%%{http_code}" http://localhost:3002/api/check-api
if errorlevel 1 (
  echo ❌ Proxy NO disponible
) else (
  echo ✅ Proxy DISPONIBLE
  curl http://localhost:3002/api/check-api
)

echo.
echo API .NET (puerto 5001):
curl -s -o nul -w "%%{http_code}" http://localhost:5001 -m 5
if errorlevel 1 (
  echo ❌ API .NET NO disponible
  echo.
  echo Por favor inicia tu API .NET en localhost:5001
) else (
  echo ✅ API .NET DISPONIBLE
)

echo.
echo Servidor estatico (puerto 3000):
curl -s -o nul -w "%%{http_code}" http://localhost:3000/ -m 5
if errorlevel 1 (
  echo ❌ Servidor estatico NO disponible
) else (
  echo ✅ Servidor estatico DISPONIBLE
)

echo.
echo ============================================
echo PUERTOS EN USO
echo ============================================
netstat -ano | findstr :3000
netstat -ano | findstr :3002
netstat -ano | findstr :5001

echo.
echo ============================================
echo ACCIONES RECOMENDADAS
echo ============================================
echo.
echo Si la API .NET no esta disponible:
echo 1. Inicia tu proyecto ASP.NET Core
echo 2. Asegurate de que corra en puerto 5001
echo 3. Verifica en la terminal de .NET
echo.
echo Para usar la aplicacion:
echo 1. Abre http://localhost:3000
echo 2. Si no funciona, ejecuta: npm run server
echo 3. Verifica el indicador de conexion arriba a la derecha
echo.

pause