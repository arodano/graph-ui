# Guía para Solucionar Timeout en Master Data

## 📋 **Resumen del Problema**
Estás recibiendo timeout al intentar obtener master data porque:
1. Tu API .NET no está corriendo en `localhost:5001` 
2. El proxy está configurado pero no puede conectarse al destino

## 🔍 **Diagnóstico Actual**
Según el diagnóstico del proxy (`/api/health`):
```
API Status: unavailable
Error: connection refused (ECONNRESET)
```

## 🚀 **Solución Paso a Paso**

### **Paso 1: Verificar Servidores en Ejecución**
```bash
# Terminal 1 - Proxy (puerto 3002)
npm run proxy

# Terminal 2 - Servidor estático (puerto 3000)  
npm run server
```

### **Paso 2: Verificar que la API .NET esté corriendo**
```bash
# Verificar si hay algo en el puerto 5001
curl -I http://localhost:5001
```

Si falla, necesitas iniciar tu API .NET (probablemente un proyecto ASP.NET Core) en el puerto 5001.

### **Paso 3: Verificaciones desde el navegador**
1. Abre http://localhost:3000
2. Deberías ver un indicador en la esquina superior derecha:
   - **✅ Verde**: Proxy funcionando
   - **❌ Rojo**: Proxy no disponible

### **Paso 4: Si tu API .NET usa HTTPS**
Si tu API corre en `https://localhost:5001`, necesitas actualizar el proxy:

```javascript
// En proxy.js, línea 20:
target: 'https://localhost:5001',  // Cambiar de http a https
```

### **Paso 5: Si tu API corre en otro puerto**
Verifica el puerto correcto:
```bash
# Ver puertos utilizados por procesos .NET
netstat -ano | findstr :5001
netstat -ano | findstr :5000
netstat -ano | findstr :7000
```

Actualiza en `proxy.js` si es diferente:
```javascript
target: 'http://localhost:5001',  // Cambiar al puerto correcto
```

## 🔧 **Mejoras Implementadas**

### **1. Timeouts Extendidos**
- **Proxy**: 5 minutos (300,000 ms) para peticiones lentas
- **Frontend**: 30 segundos para peticiones de usuario

### **2. Mejor Manejo de Errores**
- Timeouts claros con mensajes descriptivos
- Indicador visual de estado de API
- Errores específicos por tipo (conexión vs timeout)

### **3. Diagnóstico Mejorado**
- Endpoint `/api/health` para verificar conectividad
- Endpoint `/api/check-api` para verificación simple
- Logs detallados en consola del proxy

## 🎯 **Flujo de Solución**

### **Escenario A: API .NET no está corriendo**
```
✅ Proxy corriendo en: http://localhost:3002
✅ Servidor estático en: http://localhost:3000  
❌ API .NET en: localhost:5001 → NO DISPONIBLE
```

**Solución**: Iniciar tu proyecto .NET API en el puerto 5001.

### **Escenario B: API .NET en puerto diferente**
```
✅ Proxy configurado para: http://localhost:5001
✅ API .NET realmente en: http://localhost:7001
```

**Solución**: Actualizar `proxy.js` línea 20 al puerto correcto.

### **Escenario C: API .NET con HTTPS**
```
✅ Proxy configurado para: http
❌ API .NET requiere: https
```

**Solución**: Cambiar `http://` por `https://` en `proxy.js`.

## 📊 **Verificación Rápida**

### **Desde terminal:**
```bash
# Verificar proxy
curl http://localhost:3002/api/health

# Verificar API .NET (si está corriendo)
curl -I http://localhost:5001

# Verificar servidor estático
curl -I http://localhost:3000
```

### **Desde navegador:**
1. http://localhost:3000 → Aplicación
2. http://localhost:3002/api/health → Estado del proxy
3. http://localhost:5001 → Tu API .NET

## 🆘 **Solución Rápida si No Tienes Acceso a la API .NET**

Si no puedes iniciar la API .NET ahora mismo, puedes:

### **Opción 1: Usar Datos de Prueba**
Modifica `src/sidebar.js` para usar datos simulados temporalmente:

```javascript
// En _qs('si-fetch').addEventListener...
try {
    // Simular respuesta exitosa
    setTimeout(() => {
        ctx.payableItems = [/* datos de prueba */];
        _qs('items-modal').style.display = 'none';
        _renderItemsTable(ctx.payableItems);
        _qs('si-fetch').disabled = false;
        _qs('si-fetch').textContent = 'Fetch';
    }, 1000);
    return; // Salir temprano
} catch (e) {
    // ...
}
```

### **Opción 2: Mostrar Mensaje de Configuración**
Actualiza el mensaje de error para ser más claro:

```javascript
if (e.name === 'AbortError') {
    _qs('si-err').innerHTML = `
        <strong>API no disponible</strong><br>
        1. Asegúrate que la API .NET esté corriendo<br>
        2. Verifica en: http://localhost:5001<br>
        3. Puerto correcto? Actualiza proxy.js línea 20
    `;
}
```

## ✅ **Pasos Finales de Verificación**

1. **Iniciar API .NET** en el puerto correcto (normalmente 5001)
2. **Verificar con curl**: `curl http://localhost:5001/api`
3. **Iniciar proxy**: `npm run proxy`
4. **Iniciar servidor**: `npm run server`
5. **Abrir navegador**: http://localhost:3000
6. **Probar funcionalidad**: Cargar fórmulas y master data

## 📞 **Para Más Ayuda**

Si el problema persiste, revisa:
1. Firewall bloqueando el puerto 5001
2. La API .NET necesita autenticación especial
3. Configuración de CORS en el proyecto .NET
4. Logs de la aplicación .NET al intentar conexiones