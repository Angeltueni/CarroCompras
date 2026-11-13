const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:4001',
  products: process.env.PRODUCTS_SERVICE_URL || 'http://localhost:4002',
  billing: process.env.BILLING_SERVICE_URL || 'http://localhost:4003'
};

// Helper proxy que reenvía solicitudes a cada microservicio
async function proxyRequest(targetUrl, req, res) {
  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {})
      }
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json().catch(() => ({}));
    return res.status(response.status).json(data);
  } catch (err) {
    console.error(`Error de red al redirigir a ${targetUrl}:`, err.message);
    return res.status(502).json({
      error: 'Microservicio no disponible',
      details: err.message,
      target: targetUrl
    });
  }
}

// Health check unificado
app.get('/health', (req, res) => {
  res.json({
    gateway: 'ok',
    services: SERVICES,
    timestamp: new Date().toISOString()
  });
});

// Enrutamiento de microservicio Auth
app.all('/api/auth/*', (req, res) => {
  const path = req.url.replace('/api/auth', '');
  proxyRequest(`${SERVICES.auth}${path}`, req, res);
});

// Enrutamiento de microservicio Products
app.all('/api/products*', (req, res) => {
  const path = req.url.replace('/api', '');
  proxyRequest(`${SERVICES.products}${path}`, req, res);
});

// Enrutamiento de microservicio Billing
app.all('/api/billing/*', (req, res) => {
  const path = req.url.replace('/api/billing', '');
  proxyRequest(`${SERVICES.billing}${path}`, req, res);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 API GATEWAY central activo en http://localhost:${PORT}`);
  console.log(`🔐 Auth Service:     ${SERVICES.auth}`);
  console.log(`📦 Products Service: ${SERVICES.products}`);
  console.log(`🧾 Billing Service:  ${SERVICES.billing}`);
  console.log(`=================================================`);
});
