const express = require('express');
const cors = require('cors');
const { supabase, SUPABASE_URL } = require('./supabaseClient');
const { requireAdmin } = require('./authToken');

const app = express();
app.use(cors());
app.use(express.json());

console.log('[Products Service] Conectando a Supabase URL:', SUPABASE_URL);

const adminOnly = requireAdmin(supabase);
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80';

const format = (p) => ({ ...p, price: Number(p.price) });

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'products-service', database: 'supabase' }));

// ==================== LECTURA (pública) ====================

app.get('/products', async (req, res) => {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Error consultando productos en Supabase', details: error.message });
    }

    const formatted = (products || []).map(format);
    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    res.status(500).json({ error: 'Fallo interno en microservicio de Productos', details: err.message });
  }
});

app.get('/products/:id', async (req, res) => {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ success: true, data: format(product) });
  } catch (err) {
    res.status(500).json({ error: 'Fallo interno en microservicio de Productos', details: err.message });
  }
});

// ==================== ESCRITURA (solo admin) ====================

// Valida y normaliza los campos recibidos. `partial` = edición (todo opcional).
function parseProductBody(body, partial) {
  const out = {};

  if (body.name !== undefined || !partial) {
    if (!body.name || !String(body.name).trim()) return { error: 'El nombre es requerido' };
    out.name = String(body.name).trim();
  }
  if (body.price !== undefined || !partial) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) return { error: 'El precio debe ser un número mayor o igual a 0' };
    out.price = price;
  }
  if (body.category !== undefined || !partial) {
    out.category = String(body.category || 'General').trim() || 'General';
  }
  if (body.image !== undefined || !partial) {
    out.image = String(body.image || '').trim() || DEFAULT_IMAGE;
  }
  if (!partial) {
    const stock = body.stock === undefined ? 0 : Number(body.stock);
    if (!Number.isInteger(stock) || stock < 0) return { error: 'El stock inicial debe ser un entero mayor o igual a 0' };
    out.stock = stock;
  }
  return { value: out };
}

app.post('/products', adminOnly, async (req, res) => {
  const parsed = parseProductBody(req.body, false);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  try {
    const product = { id: `prod_${Date.now()}`, ...parsed.value };
    const { data, error } = await supabase.from('products').insert([product]).select('*').single();
    if (error) return res.status(500).json({ error: 'Error creando producto', details: error.message });
    res.status(201).json({ success: true, data: format(data) });
  } catch (err) {
    res.status(500).json({ error: 'Fallo interno en microservicio de Productos', details: err.message });
  }
});

// Edita datos del producto. El stock NO se edita aquí: usa /stock (ajuste atómico).
app.put('/products/:id', adminOnly, async (req, res) => {
  const parsed = parseProductBody(req.body, true);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  if (Object.keys(parsed.value).length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .update(parsed.value)
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();
    if (error) return res.status(500).json({ error: 'Error actualizando producto', details: error.message });
    if (!data) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ success: true, data: format(data) });
  } catch (err) {
    res.status(500).json({ error: 'Fallo interno en microservicio de Productos', details: err.message });
  }
});

// Aumenta (o disminuye con número negativo) el stock de forma atómica. Body: { amount: 10 }
app.post('/products/:id/stock', adminOnly, async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isInteger(amount) || amount === 0) {
    return res.status(400).json({ error: 'La cantidad debe ser un entero distinto de 0' });
  }

  try {
    const { data: stock, error } = await supabase.rpc('adjust_stock', { p_id: req.params.id, p_delta: amount });
    if (error) {
      const notFound = /no encontrado/i.test(error.message);
      const business = notFound || /negativo/i.test(error.message);
      return res.status(notFound ? 404 : business ? 400 : 500).json({
        error: business ? error.message : 'Error ajustando stock (¿ejecutaste supabase_stock_roles.sql?)',
        details: error.message
      });
    }
    res.json({ success: true, data: { id: req.params.id, stock } });
  } catch (err) {
    res.status(500).json({ error: 'Fallo interno en microservicio de Productos', details: err.message });
  }
});

app.delete('/products/:id', adminOnly, async (req, res) => {
  try {
    const { data, error } = await supabase.from('products').delete().eq('id', req.params.id).select('id');
    if (error) return res.status(500).json({ error: 'Error eliminando producto', details: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fallo interno en microservicio de Productos', details: err.message });
  }
});

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => {
  console.log(`[Products Service] 📦 Microservicio activo en puerto ${PORT}`);
});
