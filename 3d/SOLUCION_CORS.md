# Solución para Problemas de CORS

## Problema Original
Cuando intentabas acceder desde el Live View (normalmente `http://localhost:3000`) a tu API en `https://localhost:5001`, el navegador bloqueaba las peticiones debido a políticas de CORS (Cross-Origin Resource Sharing).

## Solución Implementada

He configurado un proxy en Node.js que actúa como intermediario entre tu frontend y las siguientes APIs:

### 1. **Servidor de Desarrollo** (`server.js`)
- **Puerto**: 3000
- **Función**: Sirve tu aplicación estática (HTML, JS, CSS)
- **URL**: `http://localhost:3000`

### 2. **Proxy de API** (`proxy.js`) - Actualizado
- **Puerto**: 3002
- **Funciones**:
  - Proxy para tu API .NET en `http://localhost:5001`
  - Conexión a la base de datos SQL Server
  
### 3. **Flujo de Comunicación**
```
✅ Navegador (localhost:3000) → Servidor Estático (localhost:3000)
✅ Servidor Estático → Proxy de API (localhost:3002) → API .NET (localhost:5001)
✅ No hay CORS porque todo está en el mismo origen (localhost:3000)
```

## Cómo Usar

### Opción 1: Modo Desarrollo Completo (Recomendado)
```bash
# Instalar dependencias si no lo has hecho
npm install

# Ejecutar ambos servidores simultáneamente
npm run dev
```

### Opción 2: Servidores Separados
```bash
# Terminal 1: Ejecutar el proxy de API (puerto 3002)
npm run proxy

# Terminal 2: Ejecutar el servidor estático (puerto 3000)
npm run server
```

### Opción 3: Solo Proxy de API (si ya tienes un servidor web)
```bash
# Solo ejecutar el proxy (para cuando uses Live View de VS Code)
npm run proxy
```

## Cambios Realizados

### 1. **Proxy Actualizado** (`proxy.js`)
- Cambiado a puerto 3002 para evitar conflictos
- Agregado `http-proxy-middleware` para redirigir tráfico a tu API .NET
- Configuración de CORS mejorada para aceptar todas las peticiones de desarrollo
- Logs para debugging de solicitudes

### 2. **Frontend Actualizado** (`src/sidebar.js`)
- Todas las llamadas a la API ahora van a `http://localhost:3001` en lugar de `https://localhost:5001`
- Esto evita problemas de CORS porque el proxy ya tiene CORS configurado

### 3. **Nuevos Scripts** (`package.json`)
- `npm run server`: Ejecuta el servidor estático en puerto 3000
- `npm run dev`: Ejecuta ambos servidores simultáneamente

## Uso en Desarrollo

1. **Inicia ambos servidores**:
   ```bash
   npm run dev
   ```

2. **Abre tu navegador** en: `http://localhost:3000`

3. **Tu aplicación funcionará sin problemas de CORS** porque:
   - El frontend se sirve desde `localhost:3000`
   - Las llamadas a la API van a `localhost:3001/api/v1/FormulaGraph/...`
   - El proxy en `localhost:3001` redirige a tu API real en `localhost:5001`
   - No hay comunicación entre orígenes diferentes

## Ventajas

1. **Sin problemas de CORS**: Todo el tráfico pasa por el mismo origen
2. **Mejor experiencia de desarrollo**: Puedes usar recarga en caliente y debugging completo
3. **Flexible**: Puedes seguir usando VS Code Live View si lo prefieres
4. **Producción-ready**: Fácil de configurar para despliegues

## Notas Importantes

- Asegúrate de que tu API .NET esté ejecutándose en `localhost:5001`
- Las credenciales de base de datos se mantienen en el proxy para desarrollo local
- En producción, deberías configurar CORS directamente en tu API .NET o usar un proxy similar

## Solución Alternativa (si prefieres Live View)

Si prefieres usar el Live View de VS Code, modifica `src/sidebar.js` para usar:

```javascript
const ctx = {
    // ... otras configuraciones
    apiBase: 'http://localhost:3001/api/v1/FormulaGraph',
    proxyBase: 'http://localhost:3001',
};
```

Y ejecuta solo el proxy:
```bash
npm run proxy
```

Luego inicia el Live View normalmente desde VS Code.