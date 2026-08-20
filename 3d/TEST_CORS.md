# Verificación de Configuración CORS

## Servidores en Ejecución

### ✅ **Proxy de API** - Puerto 3002
```bash
# Terminal 1 - Proxy
npm run proxy

# Verificación
curl -I http://localhost:3002/api/formulas
curl -I http://localhost:3002/api/v1/FormulaGraph/debug-node
```

### ✅ **Servidor Estático** - Puerto 3000
```bash
# Terminal 2 - Servidor Web
npm run server

# Verificación
curl -I http://localhost:3000/
curl -I http://localhost:3000/index.html
curl -I http://localhost:3000/api/
```

## Cómo Probar

### Opción A: Usar el servidor estático (RECOMENDADO)
1. **Iniciar ambos servidores**:
   ```bash
   npm run dev
   ```

2. **Abrir navegador** en: http://localhost:3000

3. **Verificar en consola del navegador**:
   - Abrir DevTools (F12)
   - Ir a la pestaña Network
   - Cargar la página
   - Verificar que no haya errores CORS

### Opción B: Usar Live View de VS Code (Alternativa)
1. **Iniciar solo el proxy**:
   ```bash
   npm run proxy
   ```

2. **Abrir index.html** con Live View de VS Code
3. **Verificar en consola del navegador**

## Solución Alternativa para Live View

Si prefieres usar Live View, modifica la línea en `src/sidebar.js`:

```javascript
const ctx = {
    // Cambiar de esto:
    apiBase: 'http://localhost:3002/api/v1/FormulaGraph',
    
    // A esto (para Live View):
    apiBase: 'http://localhost:3001/api/v1/FormulaGraph',
    // Y cambiar proxy.js a puerto 3001
};
```

## Problemas Comunes y Soluciones

### 1. **Puerto ya en uso**
```bash
# Ver puertos en uso
netstat -ano | findstr :3000
netstat -ano | findstr :3002

# Terminar proceso
taskkill /F /PID <PID>
```

### 2. **Error de conexión a API .NET**
- Verifica que tu API .NET esté corriendo en `localhost:5001`
- Usar `curl http://localhost:5001/api/v1/FormulaGraph` para probar

### 3. **Error de base de datos en proxy**
- Revisa las credenciales en `proxy.js`
- Verifica que tienes conexión a la base de datos SQL Server

### 4. **Errores de tipo mixed-content (HTTPS/HTTP)**
- Asegúrate de usar `http://` en lugar de `https://` para desarrollo local
- El proxy maneja tanto HTTP como HTTPS según sea necesario

## Pasos Finales

1. **Asegúrate que tu API .NET esté corriendo** en `localhost:5001`
2. **Inicia ambos servidores** con `npm run dev`
3. **Abre** http://localhost:3000 en tu navegador
4. **Verifica** que puedes cargar fórmulas y hacer peticiones sin errores CORS

La aplicación debería funcionar completamente sin errores de CORS porque todas las peticiones ahora pasan por el mismo origen (`localhost:3000`).