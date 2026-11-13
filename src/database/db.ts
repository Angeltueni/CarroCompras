import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('carrocompras.db');
    await initDatabase(dbInstance);
  }
  return dbInstance;
}

async function initDatabase(db: SQLite.SQLiteDatabase) {
  // Configurar WAL para mejor rendimiento
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    -- Tabla de sesión de usuario autenticado
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      token TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    -- Tabla de Carrito de Compras local
    CREATE TABLE IF NOT EXISTS cart_items (
      productId TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      image TEXT,
      category TEXT
    );

    -- Tabla de Historial de Facturas local
    CREATE TABLE IF NOT EXISTS invoices (
      invoiceNumber TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      customerName TEXT NOT NULL,
      customerEmail TEXT NOT NULL,
      subtotal REAL NOT NULL,
      taxRate REAL NOT NULL,
      iva REAL NOT NULL,
      total REAL NOT NULL,
      itemsJson TEXT NOT NULL,
      paymentMethod TEXT NOT NULL,
      synced INTEGER DEFAULT 0
    );

    -- Cola de sincronización offline para mutaciones pendientes hacia Supabase
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      createdAt TEXT NOT NULL
    );
  `);

  // Migración segura: agregar la columna synced si la tabla invoices fue creada previamente sin ella
  try {
    await db.execAsync(`ALTER TABLE invoices ADD COLUMN synced INTEGER DEFAULT 0;`);
  } catch {
    // Si la columna ya existe, SQLite lanzará un error que ignoramos de manera segura
  }
}

// ==================== AUTH / SESSION ====================
export async function saveLocalSession(user: { id: string; name: string; email: string }, token: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM session');
  await db.runAsync(
    'INSERT INTO session (id, name, email, token, createdAt) VALUES (?, ?, ?, ?, ?)',
    [user.id, user.name, user.email, token, new Date().toISOString()]
  );
}

export async function getLocalSession(): Promise<{ id: string; name: string; email: string; token: string } | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ id: string; name: string; email: string; token: string }>(
    'SELECT * FROM session LIMIT 1'
  );
  return row || null;
}

export async function clearLocalSession() {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM session');
}

// ==================== CART ITEMS ====================
export interface CartProduct {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  category?: string;
}

export async function getLocalCart(): Promise<CartProduct[]> {
  const db = await getDatabase();
  return await db.getAllAsync<CartProduct>('SELECT * FROM cart_items');
}

export async function addOrUpdateCartItem(product: { id: string; name: string; price: number; image?: string; category?: string }, quantityDelta = 1) {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ quantity: number }>(
    'SELECT quantity FROM cart_items WHERE productId = ?',
    [product.id]
  );

  if (existing) {
    const newQty = existing.quantity + quantityDelta;
    if (newQty <= 0) {
      await db.runAsync('DELETE FROM cart_items WHERE productId = ?', [product.id]);
    } else {
      await db.runAsync(
        'UPDATE cart_items SET quantity = ? WHERE productId = ?',
        [newQty, product.id]
      );
    }
  } else if (quantityDelta > 0) {
    await db.runAsync(
      'INSERT INTO cart_items (productId, name, price, quantity, image, category) VALUES (?, ?, ?, ?, ?, ?)',
      [product.id, product.name, product.price, quantityDelta, product.image || '', product.category || '']
    );
  }
}

export async function removeCartItem(productId: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM cart_items WHERE productId = ?', [productId]);
}

export async function clearLocalCart() {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM cart_items');
}

// ==================== INVOICES ====================
export interface LocalInvoice {
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerEmail: string;
  subtotal: number;
  taxRate: number;
  iva: number;
  total: number;
  itemsJson: string;
  paymentMethod: string;
  synced?: number;
}

export async function saveLocalInvoice(invoice: LocalInvoice) {
  const db = await getDatabase();
  try {
    await db.runAsync(
      `INSERT INTO invoices (invoiceNumber, date, customerName, customerEmail, subtotal, taxRate, iva, total, itemsJson, paymentMethod, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoice.invoiceNumber,
        invoice.date,
        invoice.customerName,
        invoice.customerEmail,
        invoice.subtotal,
        invoice.taxRate,
        invoice.iva,
        invoice.total,
        invoice.itemsJson,
        invoice.paymentMethod,
        invoice.synced ?? 0
      ]
    );
  } catch (err: any) {
    // Si la columna synced faltase en una instancia preexistente de SQLite
    if (String(err?.message || '').includes('no column named synced')) {
      try {
        await db.execAsync(`ALTER TABLE invoices ADD COLUMN synced INTEGER DEFAULT 0;`);
        await db.runAsync(
          `INSERT INTO invoices (invoiceNumber, date, customerName, customerEmail, subtotal, taxRate, iva, total, itemsJson, paymentMethod, synced)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoice.invoiceNumber,
            invoice.date,
            invoice.customerName,
            invoice.customerEmail,
            invoice.subtotal,
            invoice.taxRate,
            invoice.iva,
            invoice.total,
            invoice.itemsJson,
            invoice.paymentMethod,
            invoice.synced ?? 0
          ]
        );
        return;
      } catch (retryErr) {
        // Fallback insertando sin la columna synced
        await db.runAsync(
          `INSERT INTO invoices (invoiceNumber, date, customerName, customerEmail, subtotal, taxRate, iva, total, itemsJson, paymentMethod)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoice.invoiceNumber,
            invoice.date,
            invoice.customerName,
            invoice.customerEmail,
            invoice.subtotal,
            invoice.taxRate,
            invoice.iva,
            invoice.total,
            invoice.itemsJson,
            invoice.paymentMethod
          ]
        );
        return;
      }
    }
    throw err;
  }
}

export async function markInvoiceSynced(invoiceNumber: string) {
  const db = await getDatabase();
  try {
    await db.runAsync('UPDATE invoices SET synced = 1 WHERE invoiceNumber = ?', [invoiceNumber]);
  } catch {
    // Si la columna no estuviera presente aún
  }
}

export async function getLocalInvoices(): Promise<LocalInvoice[]> {
  const db = await getDatabase();
  try {
    return await db.getAllAsync<LocalInvoice>('SELECT * FROM invoices ORDER BY date DESC');
  } catch {
    return [];
  }
}

// ==================== OFFLINE SYNC QUEUE ====================
export interface QueueItem {
  id: number;
  action: string;
  payload: string;
  status: string;
  createdAt: string;
}

export async function addToSyncQueue(action: string, payload: any) {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO sync_queue (action, payload, status, createdAt) VALUES (?, ?, ?, ?)',
    [action, JSON.stringify(payload), 'pending', new Date().toISOString()]
  );
}

export async function getPendingSyncQueue(): Promise<QueueItem[]> {
  const db = await getDatabase();
  try {
    return await db.getAllAsync<QueueItem>("SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY id ASC");
  } catch {
    return [];
  }
}

export async function removeSyncQueueItem(id: number) {
  const db = await getDatabase();
  try {
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
  } catch {
    // ignorar si ya fue removido
  }
}
