import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  getLocalSession,
  saveLocalSession,
  clearLocalSession,
  getLocalCart,
  addOrUpdateCartItem,
  removeCartItem,
  clearLocalCart,
  CartProduct,
  saveLocalInvoice,
  getLocalInvoices,
  markInvoiceCancelled,
  LocalInvoice,
  UserRole
} from '../database/db';
import { api, Product } from '../services/api';
import { supabase } from '../services/supabase';
import {
  checkIsOnline,
  syncInvoiceWithProduction,
  flushSyncQueue,
  ensureInvoiceInCloud
} from '../services/syncService';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  token?: string;
}

// Orden estable del catálogo (igual que el del servidor: por id)
const byId = (a: Product, b: Product) => a.id.localeCompare(b.id, undefined, { numeric: true });
const normalizeProduct = (p: any): Product => ({ ...p, price: Number(p.price), stock: Number(p.stock) });

interface CartTotals {
  subtotal: number;
  taxRate: number;
  iva: number;
  total: number;
}

interface AppContextType {
  user: User | null;
  authLoading: boolean;
  isOnline: boolean;
  cart: CartProduct[];
  totals: CartTotals;
  invoices: LocalInvoice[];
  products: Product[];
  productsLoading: boolean;
  realtimeConnected: boolean;
  isAdmin: boolean;
  reloadProducts: () => Promise<void>;
  cancelInvoice: (invoiceNumber: string) => Promise<void>;
  taxRate: number;
  setTaxRate: (rate: number) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  addToCart: (product: { id: string; name: string; price: number; image?: string; category?: string }) => Promise<void>;
  decrementQuantity: (productId: string) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  checkout: (paymentMethod?: string) => Promise<LocalInvoice>;
  reloadHistory: () => Promise<void>;
  triggerSync: () => Promise<{ processed: number; errors: number }>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [cart, setCart] = useState<CartProduct[]>([]);
  const [invoices, setInvoices] = useState<LocalInvoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(false);
  const realtimeRef = useRef(false);
  const [taxRate, setTaxRate] = useState<number>(0.16); // 16% IVA por defecto
  const [totals, setTotals] = useState<CartTotals>({ subtotal: 0, taxRate: 0.16, iva: 0, total: 0 });

  // Inicializar cargando desde SQLite
  useEffect(() => {
    (async () => {
      try {
        const savedUser = await getLocalSession();
        if (savedUser) setUser(savedUser);

        const savedCart = await getLocalCart();
        setCart(savedCart);

        const savedInvoices = await getLocalInvoices();
        setInvoices(savedInvoices);

        const online = await checkIsOnline();
        setIsOnline(online);
        if (online) {
          await flushSyncQueue();
        }
      } catch (e) {
        console.error('Error inicializando estado local SQLite:', e);
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  // Monitor periódico de red y sincronizador automático al detectar conexión
  useEffect(() => {
    const interval = setInterval(async () => {
      const online = await checkIsOnline();
      setIsOnline(online);
      if (online) {
        const res = await flushSyncQueue();
        if (res.processed > 0) {
          const updated = await getLocalInvoices();
          setInvoices(updated);
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const reloadProducts = useCallback(async () => {
    try {
      const data = await api.getProducts();
      setProducts(data.map(normalizeProduct).sort(byId));
    } catch (e) {
      console.warn('Error cargando productos:', e);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  // Catálogo + stock en TIEMPO REAL: Supabase Realtime sobre la tabla products.
  // Cualquier compra, cancelación o ajuste del admin llega a todos los dispositivos al instante.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const initialLoad = setTimeout(reloadProducts, 0);

    const channel = supabase
      .channel('realtime-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload: any) => {
        if (payload.eventType === 'DELETE') {
          const removedId = payload.old?.id;
          setProducts((prev) => prev.filter((p) => p.id !== removedId));
        } else if (payload.new) {
          const next = normalizeProduct(payload.new);
          setProducts((prev) => [...prev.filter((p) => p.id !== next.id), next].sort(byId));
        }
      })
      .subscribe((status: string) => {
        const connected = status === 'SUBSCRIBED';
        realtimeRef.current = connected;
        setRealtimeConnected(connected);
        // Al (re)conectar se recarga para recuperar cambios perdidos mientras no había conexión
        if (connected) reloadProducts();
      });

    // Respaldo: si el canal en vivo no está conectado, se refresca cada 15 s
    const poll = setInterval(() => {
      if (!realtimeRef.current) reloadProducts();
    }, 15000);

    return () => {
      clearTimeout(initialLoad);
      clearInterval(poll);
      realtimeRef.current = false;
      setRealtimeConnected(false);
      supabase.removeChannel(channel);
    };
  }, [userId, reloadProducts]);

  // Recalcular montos con el microservicio cuando cambia el carrito o el IVA
  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (cart.length === 0) {
        setTotals({ subtotal: 0, taxRate, iva: 0, total: 0 });
        return;
      }
      try {
        const calc = await api.calculateBilling(
          cart.map((c) => ({ name: c.name, price: c.price, quantity: c.quantity })),
          taxRate
        );
        if (isMounted) {
          setTotals({
            subtotal: calc.subtotal,
            taxRate: calc.taxRate,
            iva: calc.iva,
            total: calc.total
          });
        }
      } catch (err) {
        console.warn('Error calculando con microservicio, usando cálculo local:', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [cart, taxRate]);

  const login = async (email: string, pass: string) => {
    const res = await api.login(email, pass);
    setUser({ ...res.user, token: res.token });
    await saveLocalSession(res.user, res.token);
  };

  const register = async (name: string, email: string, pass: string) => {
    const res = await api.register(name, email, pass);
    setUser({ ...res.user, token: res.token });
    await saveLocalSession(res.user, res.token);
  };

  const logout = async () => {
    await clearLocalSession();
    setUser(null);
  };

  const addToCart = async (prod: { id: string; name: string; price: number; image?: string; category?: string }) => {
    const available = products.find((p) => p.id === prod.id)?.stock;
    const inCart = cart.find((c) => c.productId === prod.id)?.quantity ?? 0;
    if (available !== undefined && inCart + 1 > available) {
      throw new Error(
        available <= 0
          ? `"${prod.name}" está agotado`
          : `Solo hay ${available} unidad(es) disponibles de "${prod.name}"`
      );
    }
    await addOrUpdateCartItem(prod, 1);
    const updated = await getLocalCart();
    setCart(updated);
  };

  const decrementQuantity = async (productId: string) => {
    const item = cart.find((i) => i.productId === productId);
    if (!item) return;
    await addOrUpdateCartItem({ id: productId, name: item.name, price: item.price }, -1);
    const updated = await getLocalCart();
    setCart(updated);
  };

  const removeFromCart = async (productId: string) => {
    await removeCartItem(productId);
    const updated = await getLocalCart();
    setCart(updated);
  };

  const reloadHistory = async () => {
    const inv = await getLocalInvoices();
    setInvoices(inv);
  };

  const triggerSync = async () => {
    const res = await flushSyncQueue();
    await reloadHistory();
    return res;
  };

  // Cancela una compra: la factura pasa a CANCELADA y el stock vuelve a aumentar
  const cancelInvoice = async (invoiceNumber: string) => {
    const inv = invoices.find((i) => i.invoiceNumber === invoiceNumber);
    if (!inv) throw new Error('Factura no encontrada');
    if (inv.status === 'CANCELADA') throw new Error('La factura ya está cancelada');

    await ensureInvoiceInCloud(inv, user?.id);
    await api.cancelInvoice(invoiceNumber);
    await markInvoiceCancelled(invoiceNumber);
    await reloadHistory();
  };

  const checkout = async (paymentMethod = 'Tarjeta / Efectivo'): Promise<LocalInvoice> => {
    if (cart.length === 0) throw new Error('El carrito está vacío');

    const customer = user
      ? { name: user.name, email: user.email }
      : { name: 'Cliente Mostrador', email: 'cliente@tienda.com' };

    // Emitir factura a través del microservicio de Billing: aquí se DESCUENTA el stock (todo o nada).
    // Si no alcanza el stock o no hay conexión, lanza error y no se emite nada.
    const invoiceResult = await api.createInvoice({
      customer,
      items: cart.map((c) => ({
        id: c.productId,
        productId: c.productId,
        name: c.name,
        price: c.price,
        quantity: c.quantity
      })),
      taxRate,
      paymentMethod
    });

    const localInv: LocalInvoice = {
      invoiceNumber: invoiceResult.invoiceNumber,
      date: invoiceResult.date,
      customerName: invoiceResult.customer.name,
      customerEmail: invoiceResult.customer.email,
      subtotal: invoiceResult.subtotal,
      taxRate: invoiceResult.taxRate,
      iva: invoiceResult.iva,
      total: invoiceResult.total,
      itemsJson: JSON.stringify(invoiceResult.items),
      paymentMethod: invoiceResult.paymentMethod,
      synced: 0,
      status: 'PAGADA'
    };

    // 1. Guardar permanentemente en SQLite
    await saveLocalInvoice(localInv);

    // 2. Intentar sincronizar con la base de datos de producción (Supabase) con user_id
    // Si no hay red, se guarda en la cola local de SQLite automáticamente
    const { synced } = await syncInvoiceWithProduction(localInv, user?.id);
    localInv.synced = synced ? 1 : 0;

    // 3. Vaciar carrito
    await clearLocalCart();
    setCart([]);
    await reloadHistory();

    return localInv;
  };

  return (
    <AppContext.Provider
      value={{
        user,
        authLoading,
        isOnline,
        cart,
        totals,
        invoices,
        products,
        productsLoading,
        realtimeConnected,
        isAdmin: user?.role === 'admin',
        reloadProducts,
        cancelInvoice,
        taxRate,
        setTaxRate,
        login,
        register,
        logout,
        addToCart,
        decrementQuantity,
        removeFromCart,
        checkout,
        reloadHistory,
        triggerSync
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe ser usado dentro de AppProvider');
  return ctx;
}
