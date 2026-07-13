# Cómo Subir tu Proyecto a GitHub - Guía MUY Simple

## ¿Qué es GitHub?
GitHub es un sitio donde guardas tu código en internet. Es como Google Drive pero para programadores. Railway necesita tu código en GitHub para desplegar.

## Paso 1: Crear Cuenta en GitHub (2 minutos)

1. Ve a https://github.com
2. Haz clic en **"Sign up"** (arriba a la derecha)
3. Completa el formulario:
   - Email
   - Contraseña
   - Nombre de usuario (ej: `tu_nombre_123`)
4. Verifica tu email
5. ¡Listo! Ya tienes cuenta

## Paso 2: Crear un Repositorio Nuevo (1 minuto)

1. **En GitHub**, haz clic en el **"+"** (arriba a la derecha)
2. Selecciona **"New repository"**
3. Completa:
   - **Repository name**: `copia-de-killaz2`
   - **Description**: "Mi app de login"
   - **Private**: Selecciona esto (para que solo tú lo veas)
4. Haz clic en **"Create repository"**
5. ¡GitHub te crea un repositorio vacío!

## Paso 3: Subir tu Código (5 minutos)

### Opción A: Usando Comandos (Recomendado)

Abre la terminal en tu computadora y copia-pega esto:

```bash
cd /home/ubuntu/copia-de-killaz2
git init
git add .
git commit -m "Mi app lista para Railway"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/copia-de-killaz2.git
git push -u origin main
```

**IMPORTANTE**: Reemplaza `TU_USUARIO` con tu nombre de usuario de GitHub

Ejemplo: Si tu usuario es `juan123`, entonces:
```bash
git remote add origin https://github.com/juan123/copia-de-killaz2.git
```

### Opción B: Usando GitHub Desktop (Más Fácil)

Si no quieres usar terminal:

1. Descarga **GitHub Desktop** desde https://desktop.github.com
2. Instálalo
3. Abre GitHub Desktop
4. Haz clic en **"File"** → **"Add Local Repository"**
5. Selecciona la carpeta `/home/ubuntu/copia-de-killaz2`
6. Haz clic en **"Publish repository"**
7. Asegúrate de que esté **"Private"**
8. ¡Listo! Tu código está en GitHub

## Paso 4: Verificar que Subió (1 minuto)

1. Ve a https://github.com/TU_USUARIO/copia-de-killaz2
2. Deberías ver todos tus archivos
3. Si ves carpetas como `client`, `server`, `drizzle`, ¡está bien!

## Paso 5: Conectar a Railway (Ya Está Listo)

Ahora que tu código está en GitHub:

1. Ve a https://railway.app
2. Haz clic en **"New Project"**
3. Selecciona **"Deploy from GitHub"**
4. Autoriza Railway
5. Elige el repositorio **`copia-de-killaz2`**
6. ¡Railway descargará tu código y lo desplegará!

## Actualizar tu Código Después

Cada vez que hagas cambios:

```bash
cd /home/ubuntu/copia-de-killaz2
git add .
git commit -m "Cambios nuevos"
git push
```

¡Railway redeploy automáticamente en 2-3 minutos!

## Problemas Comunes

### "fatal: not a git repository"
- Asegúrate de estar en la carpeta correcta:
  ```bash
  cd /home/ubuntu/copia-de-killaz2
  ```

### "Permission denied (publickey)"
- GitHub necesita tu clave SSH
- Sigue esto: https://docs.github.com/en/authentication/connecting-to-github-with-ssh
- O usa contraseña en lugar de SSH (más fácil para principiantes)

### "fatal: 'origin' does not appear to be a 'git' repository"
- Significa que no agregaste el repositorio correctamente
- Intenta de nuevo:
  ```bash
  git remote remove origin
  git remote add origin https://github.com/TU_USUARIO/copia-de-killaz2.git
  git push -u origin main
  ```

### "branch 'main' set up to track 'origin/main'"
- ¡Esto es BUENO! Significa que subió correctamente

## Comandos Útiles

```bash
# Ver estado
git status

# Ver qué cambios hiciste
git diff

# Ver historial de cambios
git log

# Descargar cambios de GitHub
git pull
```

---

**¡Eso es todo! Tu código está en GitHub y listo para Railway. 🚀**
