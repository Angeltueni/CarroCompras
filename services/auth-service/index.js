const express = require('express');
const cors = require('cors');
const { supabase, SUPABASE_URL } = require('./supabaseClient');
const { signToken, requireAdmin } = require('./authToken');

const app = express();
app.use(cors());
app.use(express.json());

console.log('[Auth Service] Conectando a Supabase URL:', SUPABASE_URL);

const ROLES = ['admin', 'user'];
const PUBLIC_FIELDS = 'id, name, email, role, created_at';
const adminOnly = requireAdmin(supabase);

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role || 'user' });

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'auth-service', database: 'supabase' }));

// ==================== AUTENTICACIÓN PÚBLICA ====================

// Registro público: SIEMPRE crea usuarios con rol 'user' (solo un admin puede crear admins)
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
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'El usuario ya se encuentra registrado' });
    }

    const newUser = {
      id: `user_${Date.now()}`,
      name,
      email: email.toLowerCase(),
      password,
      role: 'user'
    };

    const { error: insertError } = await supabase.from('users').insert([newUser]);
    if (insertError) {
      return res.status(500).json({ error: 'Error al registrar en Supabase', details: insertError.message });
    }

    return res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: publicUser(newUser),
      token: signToken(newUser.id)
    });
  } catch (err) {
    return res.status(500).json({ error: 'Fallo interno en microservicio de Auth', details: err.message });
  }
});

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
      user: publicUser(user),
      token: signToken(user.id)
    });
  } catch (err) {
    return res.status(500).json({ error: 'Fallo interno en microservicio de Auth', details: err.message });
  }
});

// ==================== GESTIÓN DE USUARIOS (solo admin) ====================

async function countAdmins() {
  const { count, error } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin');
  if (error) throw new Error(error.message);
  return count || 0;
}

app.get('/users', adminOnly, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(PUBLIC_FIELDS)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: 'Error listando usuarios', details: error.message });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ error: 'Fallo interno en microservicio de Auth', details: err.message });
  }
});

app.post('/users', adminOnly, async (req, res) => {
  const { name, email, password, role = 'user' } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: "El rol debe ser 'admin' o 'user'" });
  }

  try {
    const newUser = {
      id: `user_${Date.now()}`,
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      password,
      role
    };
    const { error } = await supabase.from('users').insert([newUser]);
    if (error) {
      const duplicated = error.code === '23505';
      return res.status(duplicated ? 400 : 500).json({
        error: duplicated ? 'Ya existe un usuario con ese email' : 'Error creando usuario',
        details: error.message
      });
    }
    res.status(201).json({ success: true, data: publicUser(newUser) });
  } catch (err) {
    res.status(500).json({ error: 'Fallo interno en microservicio de Auth', details: err.message });
  }
});

app.put('/users/:id', adminOnly, async (req, res) => {
  const { name, email, password, role } = req.body;
  const updates = {};
  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
    updates.name = String(name).trim();
  }
  if (email !== undefined) {
    if (!String(email).trim()) return res.status(400).json({ error: 'El email no puede estar vacío' });
    updates.email = String(email).trim().toLowerCase();
  }
  if (password) updates.password = password; // vacío/ausente = no cambiar
  if (role !== undefined) {
    if (!ROLES.includes(role)) return res.status(400).json({ error: "El rol debe ser 'admin' o 'user'" });
    updates.role = role;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  try {
    const { data: target } = await supabase.from('users').select('id, role').eq('id', req.params.id).maybeSingle();
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Nunca dejar el sistema sin administradores
    if (target.role === 'admin' && updates.role === 'user' && (await countAdmins()) <= 1) {
      return res.status(400).json({ error: 'No puedes quitar el rol al único administrador' });
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.id)
      .select(PUBLIC_FIELDS)
      .single();
    if (error) {
      const duplicated = error.code === '23505';
      return res.status(duplicated ? 400 : 500).json({
        error: duplicated ? 'Ya existe un usuario con ese email' : 'Error actualizando usuario',
        details: error.message
      });
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: 'Fallo interno en microservicio de Auth', details: err.message });
  }
});

app.delete('/users/:id', adminOnly, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
    }

    const { data: target } = await supabase.from('users').select('id, role').eq('id', req.params.id).maybeSingle();
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (target.role === 'admin' && (await countAdmins()) <= 1) {
      return res.status(400).json({ error: 'No puedes eliminar al único administrador' });
    }

    const { error } = await supabase.from('users').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: 'Error eliminando usuario', details: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fallo interno en microservicio de Auth', details: err.message });
  }
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`[Auth Service] 🔐 Microservicio activo en puerto ${PORT}`);
});
