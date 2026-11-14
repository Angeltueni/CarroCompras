# Guía de Inicio: Carrito de Compras con Microservicios, SQLite y Facturación

Esta aplicación móvil (Expo SDK 58 / React Native) cuenta con persistencia local en **SQLite**, backend distribuido en **Microservicios (Node.js/Express)**, cálculo automático de **IVA**, y generación/impresión de **Facturas en PDF**.

---

## 🏗️ 1. Arquitectura de Microservicios

El backend está ubicado en la carpeta `backend/` y consta de los siguientes servicios:

| Servicio | Puerto | Descripción |
|---|---|---|
| **API Gateway** | `http://localhost:4000` | Punto de entrada unificado para la app móvil |
| **Auth Service** | `http://localhost:4001` | Registro y login de usuarios con generación de tokens |
| **Products Service** | `http://localhost:4002` | Catálogo de productos, stock, categorías e imágenes |
| **Billing Service** | `http://localhost:4003` | Cálculo de subtotales, desglose de IVA y emisión de facturas |

### Cómo iniciar los Microservicios:
Abre una terminal y ejecuta:
```bash
cd backend
node run-all.js
```
*(Inicia todos los microservicios y el API Gateway simultáneamente).*

---

## 📱 2. Base de Datos SQLite Local (`expo-sqlite`)

La app utiliza la base de datos `carrocompras.db` para garantizar funcionalidad offline y persistencia inmediata:

1. **`session`**: Almacena el token y los datos del usuario autenticado para mantener la sesión iniciada al reabrir la app.
2. **`cart_items`**: Guarda el carrito de compras en tiempo real (añadir, sumar, restar, eliminar productos sin perder el estado).
3. **`invoices`**: Guarda el historial de facturas generadas para consulta e impresión offline.

---

## 🧾 3. Cálculo de IVA e Impresión de Facturas

- **Cálculo reactivo de IVA**: Puedes seleccionar la tasa de IVA directamente en el carrito (0%, 8%, 16%, 19%). El microservicio calcula el subtotal, el monto exacto del impuesto y el total final.
- **Generación e Impresión**: Al presionar **"Generar Factura"**, se crea el registro en el microservicio y en SQLite local. Permite:
  - **Imprimir**: Envía la factura al diálogo nativo de impresoras del sistema operativo.
  - **Compartir PDF**: Exporta la factura en PDF para enviarla por WhatsApp, correo o guardarla en el dispositivo.

---

## 🚀 4. Cómo Iniciar la App Móvil

En una terminal en la raíz del proyecto:
```bash
npx expo start
```
- Presiona `w` para probar en Web.
- Presiona `a` para abrir en emulador Android o escanea el QR con la app **Expo Go** en tu celular.

### Credenciales de prueba (Microservicio Auth):
| Rol | Email | Contraseña |
|---|---|---|
| **Administrador** | `admin@test.com` | `admin123` |
| Usuario | `demo@test.com` | `123` |

*(Las cuentas se crean al ejecutar `supabase_stock_roles.sql`. El registro público siempre crea usuarios con rol "usuario"; solo un admin puede crear otros admins. Cambia la contraseña del admin.)*

## Stock, roles y tiempo real

**Paso obligatorio (una sola vez):** ejecuta [supabase_stock_roles.sql](supabase_stock_roles.sql) en el SQL Editor de Supabase. Crea el rol `admin`/`user`, las funciones atómicas de stock, el estado de factura y activa Realtime sobre `products`.

- **Stock en vivo:** el catálogo se actualiza al instante en todos los dispositivos (Supabase Realtime). Si el canal en vivo no conecta, se refresca cada 15 s.
- **Comprar baja el stock:** al generar la factura se descuenta de forma atómica. Si algún producto no alcanza, no se descuenta nada y no se emite la factura. Requiere conexión.
- **Cancelar devuelve el stock:** en *Facturas* → "Cancelar compra y devolver stock". La factura pasa a CANCELADA y el stock se devuelve una sola vez.
- **Admin** (pestaña *Admin*, solo visible con rol admin):
  - *Productos y stock:* crear, editar, eliminar y aumentar stock.
  - *Usuarios:* crear, editar (nombre, email, contraseña, rol) y eliminar. No se puede eliminar ni degradar al único admin, ni eliminarse a uno mismo.
- Las operaciones de admin las valida el servidor con un token firmado (`AUTH_SECRET`) y el rol leído de la base de datos.

### Variables de entorno de los microservicios
- `AUTH_SECRET`: mismo valor en `auth` y `products`. En Render lo genera `render.yaml` (grupo `carrocompras-shared`). En local usa un valor de desarrollo por defecto.
- `SUPABASE_SERVICE_KEY` (opcional): si se define, los servicios la usan en lugar de la clave pública.

Tras desplegar, redespliega **gateway, auth, products y billing** en Render.
