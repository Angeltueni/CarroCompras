const { spawn } = require('child_process');
const path = require('path');

const services = [
  { name: 'Auth Service', script: path.join(__dirname, 'auth-service', 'index.js') },
  { name: 'Products Service', script: path.join(__dirname, 'products-service', 'index.js') },
  { name: 'Billing Service', script: path.join(__dirname, 'billing-service', 'index.js') },
  { name: 'API Gateway', script: path.join(__dirname, 'gateway', 'index.js') }
];

console.log('Iniciando infraestructura de microservicios...');

services.forEach(srv => {
  const proc = spawn('node', [srv.script], { stdio: 'inherit' });
  proc.on('close', code => {
    console.log(`[${srv.name}] terminó con código ${code}`);
  });
});
