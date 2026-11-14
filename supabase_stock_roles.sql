-- ==============================================================================
-- MIGRACIÓN: ROLES (admin/user), STOCK ATÓMICO, CANCELACIÓN DE FACTURAS Y REALTIME
-- Ejecuta este archivo UNA VEZ en el SQL Editor de Supabase (es idempotente):
-- https://supabase.com/dashboard/project/qhgbplpzmsvedjjncrxx/sql
-- Requiere haber ejecutado antes supabase_schema.sql
-- ==============================================================================

-- 1. ROLES -------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

DO $$ BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Usuario administrador inicial (cambia la contraseña después de entrar)
INSERT INTO public.users (id, name, email, password, role)
VALUES ('user_admin', 'Administrador', 'admin@test.com', 'admin123', 'admin')
ON CONFLICT (email) DO UPDATE SET role = 'admin';

-- Usuario de prueba normal
INSERT INTO public.users (id, name, email, password, role)
VALUES ('user_demo', 'Usuario Demo', 'demo@test.com', '123', 'user')
ON CONFLICT (email) DO NOTHING;

-- 2. STOCK NUNCA NEGATIVO ----------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.products
    ADD CONSTRAINT products_stock_nonneg CHECK (stock >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. ESTADO DE FACTURAS (PAGADA / CANCELADA) ---------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PAGADA';
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 4. POLÍTICAS DELETE (el admin borra productos y usuarios) -------------------
DROP POLICY IF EXISTS "Permitir delete products" ON public.products;
CREATE POLICY "Permitir delete products" ON public.products FOR DELETE USING (true);
DROP POLICY IF EXISTS "Permitir delete users" ON public.users;
CREATE POLICY "Permitir delete users" ON public.users FOR DELETE USING (true);

-- 5. FUNCIONES DE STOCK (cada llamada es una transacción atómica) -------------

-- Descuenta stock de varios productos. Si UNO no alcanza, no se descuenta NADA.
-- p_items: [{"id": "...", "quantity": 2}, ...]
CREATE OR REPLACE FUNCTION public.reserve_stock(p_items jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  it jsonb;
  v_id text;
  v_qty integer;
  v_name text;
BEGIN
  -- Orden estable por id para evitar deadlocks entre compras simultáneas
  FOR it IN
    SELECT value FROM jsonb_array_elements(p_items)
    ORDER BY COALESCE(value->>'id', value->>'productId')
  LOOP
    v_id  := COALESCE(it->>'id', it->>'productId');
    v_qty := (it->>'quantity')::integer;

    IF v_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para el producto %', COALESCE(v_id, '(sin id)');
    END IF;

    UPDATE public.products
       SET stock = stock - v_qty
     WHERE id = v_id AND stock >= v_qty;

    IF NOT FOUND THEN
      SELECT name INTO v_name FROM public.products WHERE id = v_id;
      IF v_name IS NULL THEN
        RAISE EXCEPTION 'El producto % ya no existe', v_id;
      END IF;
      RAISE EXCEPTION 'Stock insuficiente para "%"', v_name;
    END IF;
  END LOOP;
END;
$$;

-- Devuelve stock (usado al cancelar una compra)
CREATE OR REPLACE FUNCTION public.release_stock(p_items jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  it jsonb;
  v_id text;
  v_qty integer;
BEGIN
  FOR it IN
    SELECT value FROM jsonb_array_elements(p_items)
    ORDER BY COALESCE(value->>'id', value->>'productId')
  LOOP
    v_id  := COALESCE(it->>'id', it->>'productId');
    v_qty := (it->>'quantity')::integer;
    IF v_id IS NOT NULL AND v_qty IS NOT NULL AND v_qty > 0 THEN
      -- Si el producto fue eliminado entre tanto, simplemente no hay nada que devolver
      UPDATE public.products SET stock = stock + v_qty WHERE id = v_id;
    END IF;
  END LOOP;
END;
$$;

-- Ajuste de stock por el admin (positivo = aumentar). Devuelve el stock resultante.
CREATE OR REPLACE FUNCTION public.adjust_stock(p_id text, p_delta integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock integer;
BEGIN
  UPDATE public.products
     SET stock = stock + p_delta
   WHERE id = p_id AND stock + p_delta >= 0
  RETURNING stock INTO v_stock;

  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.products WHERE id = p_id) THEN
      RAISE EXCEPTION 'El stock no puede quedar negativo';
    END IF;
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  RETURN v_stock;
END;
$$;

-- Cancela una factura PAGADA y devuelve su stock. Solo funciona una vez por factura.
CREATE OR REPLACE FUNCTION public.cancel_invoice(p_invoice_number text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_items jsonb;
BEGIN
  UPDATE public.invoices
     SET status = 'CANCELADA', cancelled_at = NOW()
   WHERE invoice_number = p_invoice_number AND status = 'PAGADA'
  RETURNING items INTO v_items;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada o ya cancelada';
  END IF;

  PERFORM public.release_stock(v_items);
END;
$$;

-- 6. REALTIME: publicar cambios de la tabla products ---------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
