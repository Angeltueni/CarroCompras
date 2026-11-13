import React, { createContext, useContext, useState, useEffect } from 'react';
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
  LocalInvoice
} from '../database/db';
import { api } from '../services/api';
import { checkIsOnline, syncInvoiceWithProduction, flushSyncQueue } from '../services/syncService';

interface User {
  id: string;
  name: string;
  email: string;
  token?: string;
}

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
    setUser(res.user);
    await saveLocalSession(res.user, res.token);
  };

  const register = async (name: string, email: string, pass: string) => {
    const res = await api.register(name, email, pass);
    setUser(res.user);
    await saveLocalSession(res.user, res.token);
  };

  const logout = async () => {
    await clearLocalSession();
    setUser(null);
  };

  const addToCart = async (prod: { id: string; name: string; price: number; image?: string; category?: string }) => {
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

  const checkout = async (paymentMethod = 'Tarjeta / Efectivo'): Promise<LocalInvoice> => {
    if (cart.length === 0) throw new Error('El carrito está vacío');

    const customer = user
      ? { name: user.name, email: user.email }
      : { name: 'Cliente Mostrador', email: 'cliente@tienda.com' };

    // Emitir factura a través del microservicio de Billing incluyendo id de producto
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
      synced: 0
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
