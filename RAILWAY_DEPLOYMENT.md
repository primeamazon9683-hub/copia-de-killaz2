# Guía de Despliegue en Railway

## Requisitos Previos

1. **Cuenta en Railway** — Regístrate en [railway.app](https://railway.app)
2. **Repositorio Git** — Tu código debe estar en GitHub (público o privado)
3. **Variables de Entorno** — Ten listas todas las claves secretas

## Paso 1: Preparar el Repositorio

### 1.1 Inicializar Git (si no está hecho)
```bash
cd /home/ubuntu/copia-de-killaz2
git init
git add .
git commit -m "Initial commit - ready for Railway deployment"
```

### 1.2 Crear Repositorio en GitHub
```bash
# Crear repo privado en GitHub
gh repo create copia-de-killaz2 --private --source=. --remote=origin --push
```

## Paso 2: Conectar Railway a GitHub

1. **Accede a [railway.app](https://railway.app)** y inicia sesión
2. **Haz clic en "New Project"**
3. **Selecciona "Deploy from GitHub"**
4. **Autoriza Railway** para acceder a tu cuenta de GitHub
5. **Selecciona el repositorio** `copia-de-killaz2`
6. **Selecciona la rama** `main`

## Paso 3: Configurar Variables de Entorno

En el panel de Railway, ve a **Variables** y agrega:

### Base de Datos (MySQL/TiDB)
```
DATABASE_URL=mysql://usuario:contraseña@host:puerto/base_datos
```

### Autenticación
```
JWT_SECRET=tu_secreto_jwt_aqui
VITE_APP_ID=tu_app_id_manus
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://login.manus.im
```

### Propietario
```
OWNER_OPEN_ID=tu_open_id
OWNER_NAME=tu_nombre
```

### APIs de Manus (si usas)
```
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=tu_api_key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im
VITE_FRONTEND_FORGE_API_KEY=tu_frontend_key
```

### Telegram (para notificaciones)
```
TELEGRAM_BOT_TOKEN=tu_token_bot
TELEGRAM_CHAT_ID=tu_chat_id
```

### Analytics (si usas)
```
VITE_ANALYTICS_ENDPOINT=tu_endpoint
VITE_ANALYTICS_WEBSITE_ID=tu_website_id
```

### Otros
```
VITE_APP_TITLE=Mi Cuenta - Centro de Servicios
VITE_APP_LOGO=https://tu-logo-url.png
NODE_ENV=production
```

## Paso 4: Configurar el Dominio

### Opción A: Usar Dominio de Railway (Gratis)
1. En Railway, ve a **Settings** → **Domains**
2. Railway generará automáticamente un dominio `.railway.app`
3. Tu app estará disponible en `https://tu-app.railway.app`

### Opción B: Conectar Dominio Personalizado
1. Compra un dominio en **Namecheap**, **GoDaddy**, **Cloudflare**, etc.
2. En Railway, ve a **Settings** → **Domains** → **Add Domain**
3. Ingresa tu dominio (ej: `app.tudominio.co`)
4. Railway te mostrará los registros DNS que debes agregar
5. En tu proveedor de dominio, agrega los registros CNAME que Railway proporciona
6. Espera 5-30 minutos a que se propague el DNS

## Paso 5: Desplegar

### Opción A: Despliegue Automático (Recomendado)
1. Railway detectará automáticamente el `Dockerfile`
2. Cada push a `main` desplegará automáticamente
3. Puedes ver el progreso en **Deployments**

### Opción B: Despliegue Manual
```bash
# Hacer push a GitHub
git push origin main

# Railway desplegará automáticamente
```

## Paso 6: Verificar el Despliegue

1. **Logs en tiempo real**
   - En Railway, ve a **Logs**
   - Busca `Server running on` para confirmar que inició correctamente

2. **Probar la aplicación**
   ```bash
   curl https://tu-app.railway.app
   ```

3. **Monitorear rendimiento**
   - Railway muestra CPU, memoria y solicitudes en el dashboard

## Paso 7: Configurar Base de Datos (Primera Vez)

Si es la primera vez que despliegas:

1. **Crear base de datos MySQL en Railway**
   - En Railway, **New** → **Database** → **MySQL**
   - Copia la `DATABASE_URL` y agrégala a Variables

2. **Ejecutar migraciones**
   ```bash
   # Desde tu máquina local
   DATABASE_URL="tu_url_railway" pnpm drizzle-kit migrate
   ```

## Troubleshooting

### "Build failed"
- Verifica que el `Dockerfile` sea correcto
- Revisa los logs en Railway
- Asegúrate de que `pnpm-lock.yaml` esté en el repo

### "Port already in use"
- Railway asigna el puerto automáticamente
- El código debe leer `process.env.PORT` (ya está configurado)

### "Database connection error"
- Verifica que `DATABASE_URL` sea correcta
- Asegúrate de que la base de datos esté accesible desde Railway
- Si usas MySQL local, necesitas una base de datos remota (ej: Railway MySQL)

### "Variables de entorno no se cargan"
- En Railway, ve a **Variables** y verifica que estén todas
- Redeploy después de agregar nuevas variables

### "Dominio personalizado no funciona"
- Espera 5-30 minutos a que el DNS se propague
- Verifica que los registros CNAME sean correctos
- Usa `nslookup` para verificar: `nslookup tu-dominio.com`

## Monitoreo y Mantenimiento

### Ver logs en vivo
```bash
# En Railway dashboard → Logs
# O usa Railway CLI:
railway logs --follow
```

### Escalar recursos
- En Railway, ve a **Settings** → **Instance**
- Aumenta CPU y memoria según necesidad

### Redeploy manual
```bash
# En Railway dashboard → Deployments → Redeploy
# O hacer push a GitHub
```

## Costos en Railway

- **Primeros $5 USD/mes**: Gratis
- **Después**: Pago por uso (CPU, memoria, almacenamiento)
- **Típicamente**: $5-20 USD/mes para una app pequeña

## Comandos Útiles

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Conectar proyecto local a Railway
railway link

# Ver estado del proyecto
railway status

# Ver variables
railway variables

# Redeploy
railway deploy

# Ver logs
railway logs --follow
```

## Soporte

- **Documentación Railway**: https://docs.railway.app
- **Comunidad Discord**: https://discord.gg/railway
- **Estado del servicio**: https://status.railway.app

---

**Nota**: Este proyecto usa Node.js 22 Alpine. Si necesitas cambiar la versión, edita la primera línea del `Dockerfile`.
