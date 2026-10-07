# Fast Check INNEXA — Workspace

Tablero colaborativo para gestionar ideas de fact-checking (Ideas Iniciales → En Discusión → En Proceso → Pendiente Publicación → Publicadas), con datos guardados en **Supabase** y sincronización automática entre usuarios cada 3 segundos.

Migrado desde el artifact de Claude a un sitio estático (HTML + CSS + JS, sin dependencias ni build).

## Estructura

```
index.html            Página principal
css/styles.css        Estilos
js/config.js          URL y publishable key de Supabase
js/supabase.js        Cliente mínimo de la API REST de Supabase
js/app.js             Lógica del tablero
supabase/schema.sql   Tabla fast_check_ideas + políticas RLS
```

## Configurar Supabase

1. En tu proyecto de Supabase abre **SQL Editor** y ejecuta `supabase/schema.sql`
   (si la tabla `fast_check_ideas` ya existe, solo se aplican las políticas RLS).
2. En **Project Settings → API Keys** copia la URL y la *publishable key* y ponlas en `js/config.js`.
   Nunca uses la *secret key* (service_role) en el frontend.

## Correr en local

Cualquier servidor estático sirve, por ejemplo:

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Publicar en GitHub Pages

1. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
2. Elige la rama `main` y la carpeta `/ (root)`, y guarda.
3. En un par de minutos el sitio queda en `https://<usuario>.github.io/Fast-Check-INNEXA-Workspace/`.
   Cada push a `main` lo actualiza.

## Inicio de sesión

Solo pueden entrar las cuentas creadas en Supabase (no hay registro público):

1. **Authentication → Sign In / Providers → Email**: desactiva *Allow new users to sign up*.
2. **Authentication → Users → Add user → Create new user**: correo + contraseña, con *Auto Confirm User* marcado.
3. Las políticas RLS de `schema.sql` solo permiten leer y escribir a usuarios autenticados,
   así que sin sesión la API no entrega ninguna idea aunque alguien tenga la publishable key.

Para quitarle el acceso a alguien, bórralo en **Authentication → Users**.
