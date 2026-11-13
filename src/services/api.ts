import { Platform } from 'react-native';
import { supabase } from './supabase';

// URL de producción de los microservicios desplegados en Render
const RENDER_AUTH_URL = 'https://carrocompras.onrender.com';

const LOCAL_GATEWAY_URL = Platform.select({
  android: 'http://10.0.2.2:4000',
  default: 'http://localhost:4000',
});

export const api = {
  // MICROSERVICIO DE AUTENTICACIÓN (Desplegado en Render)
  async login(email: string, password: string) {
    try {
      const res = await fetch(`${RENDER_AUTH_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        console.log('✅ Autenticado exitosamente mediante Microservicio en Render');
        return data;
      }
      if (data?.error) throw new Error(data.error);
    } catch (renderErr: any) {
      console.warn('Microservicio Render en espera/fallback a Supabase directo:', renderErr.message);
    }

    // Respaldo de conexión directa a Supabase
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
      message: 'Inicio de sesión exitoso (Supabase directo)',
      user: { id: user.id, name: user.name, email: user.email },
      token: `token_${user.id}_${Date.now()}`
    };
  },

  async register(name: string, email: string, password: string) {
    try {
      const res = await fetch(`${RENDER_AUTH_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (res.ok) {
        console.log('✅ Usuario registrado exitosamente mediante Microservicio en Render');
        return data;
      }
      if (data?.error) throw new Error(data.error);
    } catch (renderErr: any) {
      console.warn('Microservicio Render en espera/fallback a Supabase directo:', renderErr.message);
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

  // MICROSERVICIO DE PRODUCTOS (Consulta catálogo de Supabase)
  async getProducts() {
    try {
      // 1. Intentar Gateway local si está activo
      const res = await fetch(`${LOCAL_GATEWAY_URL}/api/products`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          return data.data;
        }
      }
    } catch {
      // Continuar a Supabase
    }

    // 2. Consulta a Supabase
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
    } catch (supabaseErr: any) {
      console.warn('Error obteniendo productos de Supabase:', supabaseErr.message);
    }

    // Catálogo offline
    return [
      { id: '1', name: 'Laptop Ultrabook 15"', price: 850.00, category: 'Tecnología', stock: 15, image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&q=80' },
      { id: '2', name: 'Auriculares Inalámbricos Pro', price: 95.50, category: 'Audio', stock: 30, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80' },
      { id: '3', name: 'Teclado Mecánico RGB', price: 65.00, category: 'Periféricos', stock: 25, image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&q=80' }
    ];
  },

  // MICROSERVICIO DE FACTURACIÓN Y CÁLCULO DE IVA
  async calculateBilling(items: { name: string; price: number; quantity: number }[], taxRate = 0.16) {
    try {
      const res = await fetch(`${LOCAL_GATEWAY_URL}/api/billing/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, taxRate })
      });
      const data = await res.json();
      if (res.ok) return data.data;
    } catch {
      // Cálculo local
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
      const res = await fetch(`${LOCAL_GATEWAY_URL}/api/billing/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) return data.data;
    } catch {
      // Generación local
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
