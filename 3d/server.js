/**
 * Servidor estático para servir la aplicación y evitar problemas de CORS
 * Ejecutar con: node server.js
 */
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Configurar CORS para desarrollo
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Servir archivos estáticos desde el directorio actual
app.use(express.static(__dirname));

// Ruta principal que sirve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta para API proxy (para debug si es necesario)
app.use('/api', require('http-proxy-middleware').createProxyMiddleware({
    target: 'http://localhost:3002', // Tu proxy de base de datos
    changeOrigin: true,
    pathRewrite: {
        '^/api': '/api'
    }
}));

app.listen(PORT, () => {
    console.log(`Servidor estático ejecutándose en: http://localhost:${PORT}`);
    console.log(`  - Aplicación: http://localhost:${PORT}/`);
    console.log(`  - API (proxy): http://localhost:${PORT}/api -> http://localhost:3002/api`);
    console.log(`  - Proxy DB: http://localhost:3002/api/formulas`);
    console.log(`\n¡Abre http://localhost:${PORT} en tu navegador!`);
});