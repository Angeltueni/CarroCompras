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
- **Email:** `demo@test.com`
- **Contraseña:** `123`
*(O puedes registrar una nueva cuenta desde la pestaña "Cuenta").*
