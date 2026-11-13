const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Inicialización de Supabase con variables de entorno de producción
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qhgbplpzmsvedjjncrxx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_bMgdBdxXosxUTnlX8_XZtw_pYbnNsPT';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'products-service', database: 'supabase' }));

// Listar todos los productos desde la base de datos de producción Supabase
app.get('/products', async (req, res) => {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Error consultando productos en Supabase', details: error.message });
    }

    const formatted = (products || []).map(p => ({
      ...p,
      price: Number(p.price)
    }));

    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    res.status(500).json({ error: 'Fallo interno en microservicio de Productos', details: err.message });
  }
});

// Obtener un producto por ID
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

    res.json({
      success: true,
      data: {
        ...product,
        price: Number(product.price)
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Fallo interno en microservicio de Productos', details: err.message });
  }
});

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => {
  console.log(`[Products Service] 📦 Microservicio activo en puerto ${PORT}`);
});
