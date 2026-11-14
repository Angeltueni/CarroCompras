const express = require('express');
const cors = require('cors');
const { supabase } = require('../supabaseClient');

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

// Errores de negocio de las funciones SQL de stock (se responden 409 en vez de 500)
const isStockBusinessError = (msg = '') => /stock insuficiente|ya no existe|cantidad inv[aá]lida/i.test(msg);

// Emite la factura y DESCUENTA el stock de forma atómica (todo o nada)
app.post('/invoices', async (req, res) => {
  const { customer, items, taxRate = IVA_RATE, paymentMethod = 'Efectivo' } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No hay ítems en la factura' });
  }

  const stockItems = items.map((it) => ({
    id: it.id || it.productId,
    quantity: Number(it.quantity) || 1
  }));
  if (stockItems.some((s) => !s.id)) {
    return res.status(400).json({ error: 'Todos los ítems deben incluir el id del producto' });
  }

  try {
    const { error: stockError } = await supabase.rpc('reserve_stock', { p_items: stockItems });
    if (stockError) {
      if (isStockBusinessError(stockError.message)) {
        return res.status(409).json({ error: stockError.message });
      }
      return res.status(500).json({
        error: 'No se pudo reservar el stock (¿ejecutaste supabase_stock_roles.sql?)',
        details: stockError.message
      });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Fallo reservando stock', details: err.message });
  }

  let subtotal = 0;
  items.forEach((it) => {
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

// Cancela una factura y DEVUELVE su stock (idempotente: solo una vez por factura)
app.post('/invoices/:invoiceNumber/cancel', async (req, res) => {
  try {
    const { error } = await supabase.rpc('cancel_invoice', { p_invoice_number: req.params.invoiceNumber });
    if (error) {
      if (/no encontrada|ya cancelada/i.test(error.message)) {
        return res.status(409).json({ error: error.message });
      }
      return res.status(500).json({ error: 'No se pudo cancelar la factura', details: error.message });
    }
    res.json({ success: true, message: 'Factura cancelada y stock devuelto' });
  } catch (err) {
    res.status(500).json({ error: 'Fallo cancelando factura', details: err.message });
  }
});

const PORT = process.env.PORT || 4003;
app.listen(PORT, () => {
  console.log(`[Billing Service] Corriendo en http://localhost:${PORT}`);
});
