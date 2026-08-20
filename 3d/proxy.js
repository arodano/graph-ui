/**
 * Local DB proxy — run with: node proxy.js
 * Exposes the SQL formula data so the browser can reach it without CORS issues.
 * NOTE: credentials are for local development only. Do not commit to shared repos.
 */
const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const fetch = require('node-fetch');
const https = require('https');

const app = express();
const PORT = 3002;

// Configuración detallada de CORS
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:*', 'http://127.0.0.1:*'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    exposedHeaders: ['Content-Length', 'X-Request-ID'],
    maxAge: 600
}));

// Parse JSON para todas las rutas
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());

// Health check
app.get('/api/health', async (req, res) => {
    const health = {
        proxy: 'running',
        timestamp: new Date().toISOString(),
        api: {}
    };
    
    try {
        // Verificar conexión a la API .NET
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        try {
            const apiResponse = await fetch('https://localhost:5001/api/v1/FormulaGraph', {
                method: 'GET',
                signal: controller.signal,
                agent: new https.Agent({ rejectUnauthorized: false })
            });
            clearTimeout(timeoutId);
            
            health.api.status = apiResponse.ok ? 'available' : 'unavailable';
            health.api.statusCode = apiResponse.status;
        } catch (err) {
            clearTimeout(timeoutId);
            health.api.status = 'unavailable';
            health.api.error = err.message;
            health.api.code = err.code;
        }
    } catch (err) {
        health.api.status = 'error';
        health.api.error = err.message;
        health.api.code = err.code;
    }
    
    res.json(health);
});

// Proxy para API .NET
app.use('/api/v1/FormulaGraph', async (req, res, next) => {
    const targetUrl = `https://localhost:5001${req.originalUrl}`;
    const method = req.method;
    const headers = { ...req.headers };
    
    console.log(`[PROXY] ${method} ${req.originalUrl} → ${targetUrl}`);
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout
        
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            signal: controller.signal,
            agent: new https.Agent({ rejectUnauthorized: false })
        };
        
        // Solo incluir body para métodos que lo soportan
        if (method !== 'GET' && method !== 'HEAD' && req.body) {
            options.body = JSON.stringify(req.body);
        }
        
        console.log(`[PROXY] Sending request to API with options:`, {
            method: options.method,
            url: targetUrl,
            headers: options.headers
        });
        
        const response = await fetch(targetUrl, options);
        clearTimeout(timeoutId);
        
        console.log(`[PROXY] Response from API: ${response.status}`);
        
        // Forward headers
        Object.keys(response.headers.raw()).forEach(key => {
            res.setHeader(key, response.headers.get(key));
        });
        
        const responseData = await response.text();
        res.status(response.status).send(responseData);
        
    } catch (error) {
        console.error(`[PROXY] Error:`, error);
        if (error.name === 'AbortError') {
            res.status(504).json({ 
                error: 'Gateway Timeout', 
                message: 'La API tardó demasiado en responder',
                details: 'El servidor de API está tardando más de lo esperado en procesar la solicitud'
            });
        } else if (error.code === 'ECONNREFUSED') {
            res.status(503).json({ 
                error: 'API no disponible', 
                message: 'El servidor de API no está respondiendo en https://localhost:5001',
                details: 'Verifica que la API .NET esté corriendo'
            });
        } else {
            res.status(500).json({ 
                error: 'Proxy Error', 
                message: error.message,
                code: error.code
            });
        }
    }
});

// Endpoint para fórmulas de BD
app.get('/api/formulas', async (req, res) => {
    console.log('[DB] GET /api/formulas');
    
    try {
        console.log('[proxy] Conectando a base de datos...');
        console.log('[proxy] Usando configuración:', {
            server: DB.server,
            database: DB.database,
            user: DB.user,
            // Don't log password for security
        });
        
        const pool = await sql.connect(DB);
        
        console.log('[proxy] Ejecutando stored procedure sp_GetFormulaGraphJson...');
        const result = await pool.request().execute('sp_GetFormulaGraphJson');
        
        const rs = result.recordset;
        console.log(`[proxy] Resultado: ${rs?.length || 0} filas obtenidas`);
        
        if (!rs?.length) {
            console.log('[proxy] No se encontraron datos');
            return res.json([]);
        }

        const firstRow = rs[0];
        const cols     = Object.keys(firstRow);
        
        // Verificar si tenemos la estructura de chunks (ChunkNumber, TotalChunks, Chunk)
        if (cols.includes('Chunk') && cols.includes('ChunkNumber') && cols.includes('TotalChunks')) {
            console.log(`[proxy] Estructura detectada: Datos divididos en ${rs[0].TotalChunks} chunks`);
            
            // Ordenar por ChunkNumber para asegurar el orden correcto
            const sortedRows = rs.sort((a, b) => a.ChunkNumber - b.ChunkNumber);
            
            // Concatenar todos los chunks
            const fullJsonString = sortedRows.map(row => row.Chunk).join('');
            console.log(`[proxy] JSON concatenado: ${fullJsonString.length} caracteres totales`);
            
            try {
                const parsedData = JSON.parse(fullJsonString);
                console.log(`[proxy] JSON parseado exitosamente`);
                return res.json(parsedData);
            } catch (err) {
                console.error(`[proxy] Error al parsear JSON concatenado: ${err.message}`);
                console.error(`[proxy] Primeros 500 caracteres del JSON concatenado:`, fullJsonString.substring(0, 500));
                throw new Error(`Error al procesar datos JSON: ${err.message}`);
            }
        }

        // SQL FOR JSON PATH splits large JSON across rows in a single column
        if (cols.length === 1) {
            const jsonStr = rs.map(r => r[cols[0]]).join('');
            try {
                return res.json(JSON.parse(jsonStr));
            } catch {
                return res.json(rs); // fallback: return raw rows
            }
        }

        res.json(rs);
    } catch (err) {
        console.error('[proxy] Error en /api/formulas:', err.message);
        console.error('[proxy] Detalles del error:', err);
        console.error('[proxy] Stack trace:', err.stack);
        res.status(500).json({ 
            error: err.message,
            code: err.code,
            details: 'Error de conexión a base de datos. Verifica credenciales y configuración.' 
        });
    }
});

const DB = {
    server:   'distributtor-settlement.database.windows.net',
    port:     1433,
    database: 'dms-preprod-distribution-settlement',
    user:     'distributtor-settlement.database.windows.net',   // Updated with full username
    password: 'Liquidaciones.1518',
    options:  { 
        encrypt: true, 
        trustServerCertificate: false,
        enableArithAbort: true
    },
    pool:     { max: 5, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 90000,
    requestTimeout:    90000,
    authentication: {
        type: 'default'
    }
};

let _pool;
async function pool() {
    if (!_pool || !_pool.connected) _pool = await sql.connect(DB);
    return _pool;
}

// Endpoint para probar conexión a base de datos
app.get('/api/test-db', async (req, res) => {
    try {
        console.log('[proxy] Probando conexión a la base de datos...');
        console.log('[proxy] Configuración de conexión:', {
            server: DB.server,
            database: DB.database,
            user: DB.user,
            options: DB.options
        });
        
        // Intentar conexión simple
        const pool = await sql.connect(DB);
        
        // Ejecutar consulta simple de prueba
        const result = await pool.request().query('SELECT @@VERSION as version, DB_NAME() as dbname, CURRENT_USER as current_user');
        
        console.log('[proxy] Conexión exitosa!', {
            version: result.recordset[0]?.version?.substring(0, 100) + '...',
            dbname: result.recordset[0]?.dbname,
            current_user: result.recordset[0]?.current_user
        });
        
        res.json({ 
            success: true, 
            message: 'Conexión a base de datos exitosa',
            version: result.recordset[0].version,
            dbname: result.recordset[0].dbname,
            current_user: result.recordset[0].current_user
        });
        
        await pool.close();
    } catch (err) {
        console.error('[proxy] Error de conexión a DB:', err.message);
        console.error('[proxy] Detalles del error:', err);
        console.error('[proxy] Código de error:', err.code);
        console.error('[proxy] Stack trace:', err.stack);
        
        res.status(500).json({ 
            success: false, 
            error: err.message,
            code: err.code,
            details: 'Verifica credenciales, firewall y configuración de Azure SQL'
        });
    }
});

// Endpoint simple para verificar que la API está disponible
app.get('/api/check-api', (req, res) => {
    res.json({ 
        apiEndpoint: 'http://localhost:5001/api/v1/FormulaGraph',
        status: 'proxy_ready',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`DB proxy ready → http://localhost:${PORT}`);
    console.log('  GET  /api/formulas');
    console.log('  ALL  /api/v1/FormulaGraph/* → https://localhost:5001 (HTTPS with SSL disabled)');
});
