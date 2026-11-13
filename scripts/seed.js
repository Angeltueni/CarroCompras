const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qhgbplpzmsvedjjncrxx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'sb_publishable_bMgdBdxXosxUTnlX8_XZtw_pYbnNsPT';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const usersData = [
  {
    id: 'user_1',
    name: 'Usuario Demo',
    email: 'demo@test.com',
    password: '123'
  },
  {
    id: 'user_2',
    name: 'Carlos Mendoza',
    email: 'carlos@empresa.com',
    password: 'password123'
  }
];

const productsData = [
  { id: '1', name: 'Laptop Ultrabook 15"', price: 850.00, category: 'Tecnología', stock: 15, image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&q=80' },
  { id: '2', name: 'Auriculares Inalámbricos Pro', price: 95.50, category: 'Audio', stock: 30, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80' },
  { id: '3', name: 'Teclado Mecánico RGB', price: 65.00, category: 'Periféricos', stock: 25, image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&q=80' },
  { id: '4', name: 'Mouse Ergonómico Inalámbrico', price: 35.00, category: 'Periféricos', stock: 40, image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&q=80' },
  { id: '5', name: 'Monitor Gamer 27" 165Hz', price: 280.00, category: 'Monitores', stock: 10, image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&q=80' },
  { id: '6', name: 'Silla Ergonómica Oficina', price: 175.00, category: 'Muebles', stock: 8, image: 'https://images.unsplash.com/photo-1580481077195-c2227d8db8a9?w=500&q=80' }
];

async function seed() {
  console.log('🚀 Iniciando Seeder para Supabase...');

  // 1. Sembrar Usuarios (Insert con ignoreDuplicates)
  console.log('1. Sembrando usuarios...');
  for (const u of usersData) {
    const { data: existing } = await supabase.from('users').select('id').eq('email', u.email).single();
    if (!existing) {
      const { error } = await supabase.from('users').insert([u]);
      if (error) console.error(`   ❌ Error con usuario ${u.email}:`, error.message);
      else console.log(`   ✅ Usuario creado: ${u.email}`);
    } else {
      console.log(`   ℹ️ Usuario ya existe: ${u.email}`);
    }
  }

  // 2. Sembrar Catálogo de Productos
  console.log('2. Sembrando catálogo de productos...');
  for (const p of productsData) {
    const { data: existing } = await supabase.from('products').select('id').eq('id', p.id).single();
    if (!existing) {
      const { error } = await supabase.from('products').insert([p]);
      if (error) console.error(`   ❌ Error con producto ${p.name}:`, error.message);
      else console.log(`   ✅ Producto creado: ${p.name}`);
    } else {
      console.log(`   ℹ️ Producto ya existe: ${p.name}`);
    }
  }

  console.log('\n🎉 ¡Base de datos de producción sembrada exitosamente!');
}

seed();
