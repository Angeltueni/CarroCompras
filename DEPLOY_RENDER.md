# Guía de Despliegue en Render (Estructura de Microservicios en `/services`)

Los microservicios se encuentran desacoplados en la carpeta `services/`:

```
services/
├── gateway/          -> API Gateway central (puerto 4000)
├── auth-service/     -> Microservicio de Autenticación con Supabase (puerto 4001)
├── products-service/ -> Microservicio de Catálogo de Productos con Supabase (puerto 4002)
├── billing-service/  -> Microservicio de Facturación y cálculo de IVA (puerto 4003)
├── run-all.js        -> Script orquestador
└── package.json
```

---

### Opción A: Despliegue Unificado (Recomendada para Plan Free de Render)
1. En tu Dashboard de **[Render](https://dashboard.render.com/)**, presiona **"New +"** ➡️ **"Web Service"**.
2. Conecta tu repositorio.
3. Especifica los siguientes parámetros:
   - **Name:** `carrocompras-services`
   - **Root Directory:** `services`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node run-all.js`
4. Variables de entorno:
   - `SUPABASE_URL` = `https://qhgbplpzmsvedjjncrxx.supabase.co`
   - `SUPABASE_KEY` = `sb_publishable_bMgdBdxXosxUTnlX8_XZtw_pYbnNsPT`
5. Haz clic en **"Create Web Service"**.

---

### Opción B: Blueprint Multi-Servicio
Si prefieres que Render levante 4 servicios independientes, simplemente selecciona **"New +"** ➡️ **"Blueprint"** y Render leerá [render.yaml](file:///c:/Users/Sistemas/Downloads/CarroCompras/render.yaml) apuntando a la carpeta `services`.
