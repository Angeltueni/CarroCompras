const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Sanitización robusta de variables de entorno para evitar comillas, espacios o strings vacíos
function cleanEnv(val, fallback) {
  if (!val || typeof val !== 'string') return fallback;
  const cleaned = val.trim().replace(/^['"]|['"]$/g, '');
  return cleaned && cleaned.startsWith('http') ? cleaned : fallback;
}

function cleanKey(val, fallback) {
  if (!val || typeof val !== 'string') return fallback;
  const cleaned = val.trim().replace(/^['"]|['"]$/g, '');
  return cleaned.length > 5 ? cleaned : fallback;
}

const SUPABASE_URL = cleanEnv(process.env.SUPABASE_URL, 'https://qhgbplpzmsvedjjncrxx.supabase.co');
const SUPABASE_KEY = cleanKey(process.env.SUPABASE_KEY, 'sb_publishable_bMgdBdxXosxUTnlX8_XZtw_pYbnNsPT');

console.log('[Auth Service] Conectando a Supabase URL:', SUPABASE_URL);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'auth-service', database: 'supabase' }));

// Registro de usuario en Supabase a través del microservicio
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }

  try {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return res.status(400).json({ error: 'El usuario ya se encuentra registrado' });
    }

    const newUser = {
      id: `user_${Date.now()}`,
      name,
      email: email.toLowerCase(),
      password
    };

    const { error: insertError } = await supabase.from('users').insert([newUser]);
    if (insertError) {
      return res.status(500).json({ error: 'Error al registrar en Supabase', details: insertError.message });
    }

    return res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: { id: newUser.id, name: newUser.name, email: newUser.email },
      token: `token_${newUser.id}_${Date.now()}`
    });
  } catch (err) {
    return res.status(500).json({ error: 'Fallo interno en microservicio de Auth', details: err.message });
  }
});

// Login validado contra Supabase a través del microservicio
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('password', password)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    return res.json({
      message: 'Inicio de sesión exitoso',
      user: { id: user.id, name: user.name, email: user.email },
      token: `token_${user.id}_${Date.now()}`
    });
  } catch (err) {
    return res.status(500).json({ error: 'Fallo interno en microservicio de Auth', details: err.message });
  }
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`[Auth Service] 🔐 Microservicio activo en puerto ${PORT}`);
});
