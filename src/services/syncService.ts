import { Platform } from 'react-native';
import * as Network from 'expo-network';
import { supabase } from './supabase';
import {
  addToSyncQueue,
  getPendingSyncQueue,
  removeSyncQueueItem,
  markInvoiceSynced,
  LocalInvoice
} from '../database/db';

export async function checkIsOnline(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }
  try {
    const net = await Network.getNetworkStateAsync();
    return Boolean(net.isConnected && net.isInternetReachable !== false);
  } catch {
    return true;
  }
}

/**
 * Guarda una factura y registra las compras asociadas por usuario:
 * Si hay conexión se envía a Supabase inmediatamente;
 * Si no hay conexión o falla la red, se almacena en la cola SQLite para sincronizar al volver el internet.
 */
export async function syncInvoiceWithProduction(
  invoice: LocalInvoice,
  userId?: string
): Promise<{ synced: boolean }> {
  const isOnline = await checkIsOnline();

  if (!isOnline) {
    await addToSyncQueue('INSERT_INVOICE', { invoice, userId });
    return { synced: false };
  }

  try {
    // 1. Guardar factura en Supabase
    const { error: invError } = await supabase.from('invoices').insert([
      {
        invoice_number: invoice.invoiceNumber,
        user_id: userId || null,
        date: invoice.date,
        customer_name: invoice.customerName,
        customer_email: invoice.customerEmail,
        subtotal: invoice.subtotal,
        tax_rate: invoice.taxRate,
        iva: invoice.iva,
        total: invoice.total,
        items: JSON.parse(invoice.itemsJson),
        payment_method: invoice.paymentMethod
      }
    ]);

    if (invError) {
      console.warn('Error al guardar factura en Supabase, encolando en SQLite:', invError.message);
      await addToSyncQueue('INSERT_INVOICE', { invoice, userId });
      return { synced: false };
    }

    // 2. Guardar el desglose de compras por usuario con product_id
    try {
      const items = JSON.parse(invoice.itemsJson);
      if (Array.isArray(items) && items.length > 0) {
        const purchasesToInsert = items.map((it: any) => ({
          invoice_number: invoice.invoiceNumber,
          user_id: userId || null,
          product_id: it.id || it.productId || null,
          product_name: it.name,
          unit_price: it.price,
          quantity: it.quantity,
          total_price: +(it.price * it.quantity).toFixed(2)
        }));
        await supabase.from('purchases').insert(purchasesToInsert);
      }
    } catch (e: any) {
      console.warn('Advertencia registrando compras por ítem:', e.message);
    }

    await markInvoiceSynced(invoice.invoiceNumber);
    return { synced: true };
  } catch (err: any) {
    console.warn('Fallo de red al enviar a Supabase, encolando en SQLite:', err.message);
    await addToSyncQueue('INSERT_INVOICE', { invoice, userId });
    return { synced: false };
  }
}

/**
 * Procesa la cola de peticiones pendientes guardadas en SQLite y las envía a Supabase
 */
export async function flushSyncQueue(): Promise<{ processed: number; errors: number }> {
  const isOnline = await checkIsOnline();
  if (!isOnline) return { processed: 0, errors: 0 };

  const pendingItems = await getPendingSyncQueue();
  let processed = 0;
  let errors = 0;

  for (const item of pendingItems) {
    try {
      if (item.action === 'INSERT_INVOICE') {
        const payload = JSON.parse(item.payload);
        const inv: LocalInvoice = payload.invoice || payload;
        const userId: string | null = payload.userId || null;

        const { error } = await supabase.from('invoices').upsert([
          {
            invoice_number: inv.invoiceNumber,
            user_id: userId,
            date: inv.date,
            customer_name: inv.customerName,
            customer_email: inv.customerEmail,
            subtotal: inv.subtotal,
            tax_rate: inv.taxRate,
            iva: inv.iva,
            total: inv.total,
            items: JSON.parse(inv.itemsJson),
            payment_method: inv.paymentMethod
          }
        ], { onConflict: 'invoice_number' });

        if (!error) {
          // Registrar compras si existen
          const items = JSON.parse(inv.itemsJson);
          if (Array.isArray(items) && items.length > 0) {
            const purchasesToInsert = items.map((it: any) => ({
              invoice_number: inv.invoiceNumber,
              user_id: userId,
              product_id: it.id || it.productId || null,
              product_name: it.name,
              unit_price: it.price,
              quantity: it.quantity,
              total_price: +(it.price * it.quantity).toFixed(2)
            }));
            await supabase.from('purchases').upsert(purchasesToInsert);
          }

          await markInvoiceSynced(inv.invoiceNumber);
          await removeSyncQueueItem(item.id);
          processed++;
        } else {
          console.warn('Error al sincronizar item con Supabase:', error.message);
          errors++;
        }
      }
    } catch (e: any) {
      console.warn('Error procesando item de cola:', e.message);
      errors++;
    }
  }

  return { processed, errors };
}
