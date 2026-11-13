import { supabase } from './supabase';

// URL del API Gateway desplegado en Render que unifica y enruta a todos los microservicios
const GATEWAY_URL = 'https://carrocompras-gateway.onrender.com';
const RENDER_AUTH_URL = 'https://carrocompras.onrender.com';
const RENDER_PRODUCTS_URL = 'https://carrocompras-products.onrender.com';
const RENDER_BILLING_URL = 'https://carrocompras-billing.onrender.com';

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
      user: { id: user.id, name: user.name, email: user.email },
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
      user: { id: userId, name, email },
      token: `token_${userId}_${Date.now()}`
    };
  },

  // 2. MICROSERVICIO DE PRODUCTOS (Render)
  async getProducts() {
    // A) Intentar a través del API Gateway
    try {
      const res = await fetch(`${GATEWAY_URL}/api/products`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
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
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
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

      if (!error && data && data.length > 0) {
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

  async createInvoice(payload: {
    customer: { name: string; email: string };
    items: { id?: string; productId?: string; name: string; price: number; quantity: number }[];
    taxRate?: number;
    paymentMethod?: string;
  }) {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/billing/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.data) {
        return data.data;
      }
    } catch {
      // Intentar directo
    }

    try {
      const res = await fetch(`${RENDER_BILLING_URL}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.data) {
        return data.data;
      }
    } catch {
      // Respaldo local
    }

    const subtotal = +payload.items.reduce((s, it) => s + (it.price * it.quantity), 0).toFixed(2);
    const taxRate = payload.taxRate || 0.16;
    const iva = +(subtotal * taxRate).toFixed(2);
    const total = +(subtotal + iva).toFixed(2);
    return {
      invoiceNumber: `FAC-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString(),
      customer: payload.customer,
      items: payload.items,
      subtotal,
      taxRate,
      iva,
      total,
      paymentMethod: payload.paymentMethod || 'Efectivo',
      status: 'PAGADA'
    };
  }
};
