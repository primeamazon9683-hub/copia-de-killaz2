# Desplegar en Railway - Guía SIMPLE (Sin Tecnicismos)

## ¿Qué es Railway?
Railway es un servicio que **corre tu aplicación en internet** para que otros usuarios puedan acceder. Es como tener una computadora encendida 24/7 en la nube.

## Paso 1: Crear Cuenta en Railway (2 minutos)

1. Ve a https://railway.app
2. Haz clic en **"Sign Up"**
3. Elige **"Sign up with GitHub"** (más fácil)
4. Autoriza Railway para acceder a tu GitHub
5. ¡Listo! Ya tienes cuenta

## Paso 2: Conectar tu Código a Railway (3 minutos)

1. **En GitHub**: Crea un repositorio nuevo llamado `copia-de-killaz2`
2. **En tu computadora**, abre la terminal y copia-pega esto:
   ```bash
   cd /home/ubuntu/copia-de-killaz2
   git init
   git add .
   git commit -m "Mi app lista"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/copia-de-killaz2.git
   git push -u origin main
   ```
   (Reemplaza `TU_USUARIO` con tu usuario de GitHub)

## Paso 3: Decirle a Railway que Despliegue (5 minutos)

1. **En Railway** (https://railway.app), haz clic en **"New Project"**
2. Selecciona **"Deploy from GitHub"**
3. Elige el repositorio **`copia-de-killaz2`**
4. Railway empezará a desplegar automáticamente
5. Espera 3-5 minutos a que termine

## Paso 4: Agregar Secretos (Variables) (5 minutos)

Railway necesita saber dónde está tu base de datos y otros datos importantes.

1. **En Railway**, en tu proyecto, ve a **"Variables"**
2. Agrega estas variables (haz clic en **"+ Add Variable"** para cada una):

### Variables Obligatorias:

**DATABASE_URL** (tu base de datos)
- Ejemplo: `mysql://usuario:contraseña@host:3306/basedatos`
- Si no tienes base de datos, crea una en Railway:
  - En Railway: **"New"** → **"Database"** → **"MySQL"**
  - Copia la URL que Railway te da
  - Pégala como `DATABASE_URL`

**JWT_SECRET** (código secreto para seguridad)
- Genera uno: https://www.uuidgenerator.net/ (copia el UUID)
- O escribe algo aleatorio: `mi_secreto_super_largo_12345`

### Variables Opcionales (si usas):

Si usas Telegram para notificaciones:
```
TELEGRAM_BOT_TOKEN = tu_token_aqui
TELEGRAM_CHAT_ID = tu_chat_id_aqui
```

Si usas OAuth de Manus:
```
VITE_APP_ID = tu_app_id
OAUTH_SERVER_URL = https://api.manus.im
```

## Paso 5: Tu App Está Viva (¡Listo!)

1. **En Railway**, ve a **"Deployments"**
2. Busca un link como `https://tu-app.railway.app`
3. ¡Haz clic y tu app está en internet!

## Paso 6: Conectar tu Dominio Personalizado (Opcional)

Si compraste un dominio (ej: `miapp.co`):

1. **En Railway**, ve a **"Settings"** → **"Domains"**
2. Haz clic en **"+ Add Domain"**
3. Escribe tu dominio: `miapp.co` o `app.miapp.co`
4. Railway te da instrucciones de DNS
5. Ve a tu proveedor de dominio (GoDaddy, Namecheap, etc.)
6. Agrega los registros DNS que Railway te dice
7. Espera 5-30 minutos a que funcione

## Paso 7: Actualizar tu App (Cuando Hagas Cambios)

Cada vez que cambies código:

```bash
cd /home/ubuntu/copia-de-killaz2
git add .
git commit -m "Cambios nuevos"
git push
```

¡Railway redeploy automáticamente en 2-3 minutos!

## ¿Algo No Funciona?

### "Build failed" o "Error en despliegue"
- Ve a **"Deployments"** en Railway
- Haz clic en el despliegue fallido
- Lee los logs (mensajes de error)
- Busca la línea roja que dice qué salió mal

### "La app carga pero muestra error"
- Verifica que `DATABASE_URL` sea correcta
- Verifica que `JWT_SECRET` esté agregado
- Redeploy: en Railway, haz clic en **"Redeploy"**

### "No puedo acceder a mi dominio"
- Espera 30 minutos (el DNS tarda)
- Verifica que los registros DNS sean correctos
- En tu proveedor de dominio, busca "DNS Records" o "CNAME"

## Costos

- **Primeros $5 USD/mes**: GRATIS
- **Después**: Pagas solo lo que uses
- **Típicamente**: $5-15 USD/mes para una app pequeña

## Comandos Útiles (Opcional)

Si quieres ver logs en tiempo real desde tu computadora:

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Ver logs en vivo
railway logs --follow
```

---

**¡Eso es todo! Tu app está en internet. 🚀**

Si tienes dudas, pregunta. Railway tiene soporte en https://discord.gg/railway
