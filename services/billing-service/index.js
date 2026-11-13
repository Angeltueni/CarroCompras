const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const IVA_RATE = 0.16; // 16% IVA por defecto (configurable)

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'billing-service' }));

// Endpoint de cálculo y validación de factura
app.post('/calculate', (req, res) => {
  const { items, taxRate = IVA_RATE } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'La lista de ítems no puede estar vacía' });
  }

  let subtotal = 0;
  const processedItems = items.map(item => {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.price) || 0;
    const itemSubtotal = +(qty * price).toFixed(2);
    subtotal += itemSubtotal;
    return {
      ...item,
      quantity: qty,
      price: price,
      subtotal: itemSubtotal
    };
  });

  subtotal = +subtotal.toFixed(2);
  const iva = +(subtotal * taxRate).toFixed(2);
  const total = +(subtotal + iva).toFixed(2);

  res.json({
    success: true,
    data: {
      items: processedItems,
      subtotal,
      taxRate,
      iva,
      total,
      calculatedAt: new Date().toISOString()
    }
  });
});

// Endpoint para registrar / emitir factura final
app.post('/invoices', (req, res) => {
  const { customer, items, taxRate = IVA_RATE, paymentMethod = 'Efectivo' } = req.body;
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No hay ítems en la factura' });
  }

  let subtotal = 0;
  items.forEach(it => {
    subtotal += (Number(it.quantity) || 1) * (Number(it.price) || 0);
  });
  subtotal = +subtotal.toFixed(2);
  const iva = +(subtotal * taxRate).toFixed(2);
  const total = +(subtotal + iva).toFixed(2);

  const invoice = {
    invoiceNumber: `FAC-${Date.now().toString().slice(-6)}`,
    date: new Date().toISOString(),
    customer: customer || { name: 'Consumidor Final', email: 'cliente@ejemplo.com' },
    items,
    subtotal,
    taxRate,
    iva,
    total,
    paymentMethod,
    status: 'PAGADA'
  };

  res.status(201).json({
    success: true,
    message: 'Factura generada exitosamente',
    data: invoice
  });
});

const PORT = 4003;
app.listen(PORT, () => {
  console.log(`[Billing Service] Corriendo en http://localhost:${PORT}`);
});
