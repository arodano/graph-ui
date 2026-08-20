const express = require('express');
const http = require('http');
const https = require('https');
const fetch = require('node-fetch');

const app = express();
const PORT = 3003;

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    next();
});

app.use(express.json());

// Endpoint simple de prueba
app.get('/test', (req, res) => {
    res.json({ message: 'Proxy working', time: new Date().toISOString() });
});

// Proxy para API .NET
app.use('/api/v1/FormulaGraph', async (req, res) => {
    const targetUrl = `https://localhost:5001/api/v1/FormulaGraph${req.url}`;
    console.log(`[PROXY] Forwarding ${req.method} ${req.url} to ${targetUrl}`);
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos
        
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                ...req.headers
            },
            body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
            signal: controller.signal,
            agent: new https.Agent({ rejectUnauthorized: false })
        });
        
        clearTimeout(timeoutId);
        
        console.log(`[PROXY] Response status: ${response.status}`);
        
        const responseData = await response.text();
        
        // Forward headers
        Object.keys(response.headers.raw()).forEach(key => {
            res.setHeader(key, response.headers.get(key));
        });
        
        res.status(response.status).send(responseData);
        
    } catch (error) {
        console.error(`[PROXY] Error:`, error);
        if (error.name === 'AbortError') {
            res.status(504).json({ error: 'Gateway Timeout', message: 'La API tardó demasiado en responder' });
        } else {
            res.status(500).json({ error: 'Proxy Error', message: error.message });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Test proxy running on http://localhost:${PORT}`);
    console.log('  GET  /test');
    console.log('  ALL  /api/v1/FormulaGraph/* → https://localhost:5001');
});