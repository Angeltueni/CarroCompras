const crypto = require('crypto');

// Todos los servicios que verifican tokens deben compartir el mismo AUTH_SECRET.
const SECRET = process.env.AUTH_SECRET || 'carrocompras-dev-secret-cambiar-en-produccion';
if (!process.env.AUTH_SECRET) {
  console.warn('[Auth] ⚠️  AUTH_SECRET no definido: usando secreto de desarrollo (no usar en producción)');
}

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

function hmac(data) {
  return crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
}

// Token firmado: <payload base64url>.<firma HMAC>. El rol NO va en el token: se consulta en BD.
function signToken(userId) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  return `${payload}.${hmac(payload)}`;
}

function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = Buffer.from(hmac(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.sub || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

// Middleware: exige un token válido de un usuario con rol 'admin' (el rol se lee de la BD en cada petición)
function requireAdmin(supabase) {
  return async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const data = verifyToken(token);
    if (!data) {
      return res.status(401).json({ error: 'Sesión inválida o expirada. Cierra sesión e ingresa de nuevo.' });
    }

    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', data.sub)
        .single();

      if (error || !user) {
        return res.status(401).json({ error: 'El usuario de la sesión ya no existe' });
      }
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Se requiere rol de administrador' });
      }
      req.user = { id: user.id, role: user.role };
      return next();
    } catch (err) {
      return res.status(500).json({ error: 'No se pudo verificar el rol', details: err.message });
    }
  };
}

module.exports = { signToken, verifyToken, requireAdmin };
