import { supabase } from './supabase';

// URL del API Gateway desplegado en Render que unifica y enruta a todos los microservicios
const GATEWAY_URL = 'https://carrocompras-gateway.onrender.com';
const RENDER_AUTH_URL = 'https://carrocompras.onrender.com';
const RENDER_PRODUCTS_URL = 'https://carrocompras-products.onrender.com';
const RENDER_BILLING_URL = 'https://carrocompras-billing.onrender.com';

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  image: string;
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  created_at?: string;
}

interface ServiceResponse {
  status: number;
  ok: boolean;
  data: any;
}

/**
 * Llama al API Gateway y, si no responde, directo al microservicio.
 * Devuelve la primera respuesta "real" (status < 500). Un 404 sin cuerpo de error
 * significa ruta inexistente (despliegue desactualizado) y prueba la siguiente URL.
 */
async function callService(
  directBase: string,
  gatewayPath: string,
  directPath: string,
  opts: { method?: string; body?: unknown; token?: string } = {}
): Promise<ServiceResponse> {
  const init: RequestInit = {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {})
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
  };

  let lastError: Error | null = null;
  for (const url of [`${GATEWAY_URL}${gatewayPath}`, `${directBase}${directPath}`]) {
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (res.status === 404 && !data?.error) continue;
      if (res.status < 500) return { status: res.status, ok: res.ok, data };
      lastError = new Error(data?.error || `Servicio no disponible (${res.status})`);
    } catch (e: any) {
      lastError = e;
    }
  }
  throw lastError ?? new Error('Servicio no disponible');
}

// Llamada de administración: lanza Error con el mensaje del servidor si no es 2xx
async function adminCall(
  directBase: string,
  gatewayPath: string,
  directPath: string,
  token: string | undefined,
  opts: { method?: string; body?: unknown } = {}
) {
  if (!token) throw new Error('Sesión sin token. Cierra sesión e ingresa de nuevo.');
  const r = await callService(directBase, gatewayPath, directPath, { ...opts, token });
  if (!r.ok) throw new Error(r.data?.error || `Error ${r.status}`);
  return r.data;
}

export const api = {
  // 1. MICROSERVICIO DE AUTENTICACIÓN (Render)
  async login(email: string, password: string) {
    // Intentar primero a través del API Gateway
    try {
      const res = await fetch(`${GATEWAY_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        console.log('✅ Login exitoso vía API Gateway en Render');
        return data;
      }
    } catch {
      // Intentar directo al microservicio de Auth en Render
    }

    try {
      const res = await fetch(`${RENDER_AUTH_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        console.log('✅ Login exitoso vía Auth Service directo en Render');
        return data;
      }
      if (data?.error) throw new Error(data.error);
    } catch (err: any) {
      console.warn('Fallo en microservicio Auth Render, usando fallback Supabase:', err.message);
    }

    // Respaldo de seguridad directo a Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('password', password)
      .single();

    if (error || !user) {
      throw new Error('Credenciales inválidas');
    }

    return {
      message: 'Inicio de sesión exitoso',
      user: { id: user.id, name: user.name, email: user.email, role: user.role === 'admin' ? 'admin' : 'user' },
      token: `token_${user.id}_${Date.now()}`
    };
  },

  async register(name: string, email: string, password: string) {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (res.ok) return data;
    } catch {
      // Intentar directo al microservicio de Auth
    }

    try {
      const res = await fetch(`${RENDER_AUTH_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (res.ok) return data;
      if (data?.error) throw new Error(data.error);
    } catch (err: any) {
      console.warn('Fallo en microservicio Auth Render, usando fallback Supabase:', err.message);
    }

    // Respaldo directo en Supabase
    const userId = `user_${Date.now()}`;
    const { error } = await supabase.from('users').insert([
      { id: userId, name, email: email.toLowerCase(), password }
    ]);

    if (error) throw new Error(error.message || 'Error al registrar usuario');

    return {
      message: 'Usuario registrado exitosamente',
      user: { id: userId, name, email, role: 'user' },
      token: `token_${userId}_${Date.now()}`
    };
  },

  // 2. MICROSERVICIO DE PRODUCTOS (Render)
  async getProducts(): Promise<Product[]> {
    // A) Intentar a través del API Gateway
    try {
      const res = await fetch(`${GATEWAY_URL}/api/products`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          console.log('✅ Catálogo cargado vía API Gateway en Render');
          return data.data;
        }
      }
    } catch {
      // Intentar directo al microservicio
    }

    // B) Intentar directo al microservicio de Products en Render
    try {
      const res = await fetch(`${RENDER_PRODUCTS_URL}/products`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          console.log('✅ Catálogo cargado vía Products Service directo en Render');
          return data.data;
        }
      }
    } catch (err: any) {
      console.warn('Error conectando a microservicio Products Render:', err.message);
    }

    // C) Consulta directa a Supabase
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('id', { ascending: true });

      if (!error && data) {
        return data.map(p => ({
          ...p,
          price: Number(p.price)
        }));
      }
    } catch (e: any) {
      console.warn('Error en fallback Supabase:', e.message);
    }

    return [
      { id: '1', name: 'Laptop Ultrabook 15"', price: 850.00, category: 'Tecnología', stock: 15, image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&q=80' },
      { id: '2', name: 'Auriculares Inalámbricos Pro', price: 95.50, category: 'Audio', stock: 30, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80' }
    ];
  },

  // 3. MICROSERVICIO DE FACTURACIÓN Y CÁLCULO DE IVA (Render)
  async calculateBilling(items: { name: string; price: number; quantity: number }[], taxRate = 0.16) {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/billing/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, taxRate })
      });
      const data = await res.json();
      if (res.ok && data.data) {
        return data.data;
      }
    } catch {
      // Intentar directo a Billing Render
    }

    try {
      const res = await fetch(`${RENDER_BILLING_URL}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, taxRate })
      });
      const data = await res.json();
      if (res.ok && data.data) {
        return data.data;
      }
    } catch {
      // Cálculo local si no hay red
    }

    const subtotal = +items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2);
    const iva = +(subtotal * taxRate).toFixed(2);
    const total = +(subtotal + iva).toFixed(2);
    return { items, subtotal, taxRate, iva, total, calculatedAt: new Date().toISOString() };
  },

  // Emite la factura y descuenta el stock en el servidor (todo o nada). Requiere conexión.
  async createInvoice(payload: {
    customer: { name: string; email: string };
    items: { id?: string; productId?: string; name: string; price: number; quantity: number }[];
    taxRate?: number;
    paymentMethod?: string;
  }) {
    let r: ServiceResponse;
    try {
      r = await callService(RENDER_BILLING_URL, '/api/billing/invoices', '/invoices', {
        method: 'POST',
        body: payload
      });
    } catch (e: any) {
      throw new Error(`No se pudo confirmar el stock: sin conexión con facturación (${e.message})`);
    }
    if (r.ok && r.data?.data) return r.data.data;
    throw new Error(r.data?.error || `No se pudo emitir la factura (${r.status})`);
  },

  // Cancela la factura y devuelve el stock. Idempotente en servidor (solo una vez por factura).
  async cancelInvoice(invoiceNumber: string) {
    const n = encodeURIComponent(invoiceNumber);
    let r: ServiceResponse | null = null;
    try {
      r = await callService(RENDER_BILLING_URL, `/api/billing/invoices/${n}/cancel`, `/invoices/${n}/cancel`, {
        method: 'POST'
      });
    } catch {
      // Servicio caído: se intenta directo contra Supabase (la función SQL es la misma y atómica)
    }

    if (r) {
      if (r.ok) return;
      throw new Error(r.data?.error || `No se pudo cancelar (${r.status})`);
    }

    const { error } = await supabase.rpc('cancel_invoice', { p_invoice_number: invoiceNumber });
    if (error) throw new Error(error.message);
  },

  // ==================== ADMIN: PRODUCTOS ====================
  async createProduct(
    token: string | undefined,
    p: { name: string; price: number; category: string; stock: number; image?: string }
  ): Promise<Product> {
    const d = await adminCall(RENDER_PRODUCTS_URL, '/api/products', '/products', token, { method: 'POST', body: p });
    return d.data;
  },

  async updateProduct(
    token: string | undefined,
    id: string,
    p: { name?: string; price?: number; category?: string; image?: string }
  ): Promise<Product> {
    const d = await adminCall(RENDER_PRODUCTS_URL, `/api/products/${id}`, `/products/${id}`, token, {
      method: 'PUT',
      body: p
    });
    return d.data;
  },

  // amount > 0 aumenta el stock; < 0 lo reduce (nunca por debajo de 0)
  async adjustStock(token: string | undefined, id: string, amount: number): Promise<number> {
    const d = await adminCall(RENDER_PRODUCTS_URL, `/api/products/${id}/stock`, `/products/${id}/stock`, token, {
      method: 'POST',
      body: { amount }
    });
    return d.data.stock;
  },

  async deleteProduct(token: string | undefined, id: string) {
    await adminCall(RENDER_PRODUCTS_URL, `/api/products/${id}`, `/products/${id}`, token, { method: 'DELETE' });
  },

  // ==================== ADMIN: USUARIOS ====================
  async listUsers(token: string | undefined): Promise<ManagedUser[]> {
    const d = await adminCall(RENDER_AUTH_URL, '/api/users', '/users', token);
    return d.data;
  },

  async createUser(
    token: string | undefined,
    u: { name: string; email: string; password: string; role: 'admin' | 'user' }
  ): Promise<ManagedUser> {
    const d = await adminCall(RENDER_AUTH_URL, '/api/users', '/users', token, { method: 'POST', body: u });
    return d.data;
  },

  async updateUser(
    token: string | undefined,
    id: string,
    u: { name?: string; email?: string; password?: string; role?: 'admin' | 'user' }
  ): Promise<ManagedUser> {
    const d = await adminCall(RENDER_AUTH_URL, `/api/users/${id}`, `/users/${id}`, token, { method: 'PUT', body: u });
    return d.data;
  },

  async deleteUser(token: string | undefined, id: string) {
    await adminCall(RENDER_AUTH_URL, `/api/users/${id}`, `/users/${id}`, token, { method: 'DELETE' });
  }
};
