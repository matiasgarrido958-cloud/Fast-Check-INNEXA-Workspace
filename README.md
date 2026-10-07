# Fast Check INNEXA — Workspace

Tablero colaborativo para gestionar ideas de fact-checking (Ideas Iniciales → En Discusión → En Proceso → Pendiente Publicación → Publicadas), con datos guardados en **Supabase** y sincronización automática entre usuarios cada 3 segundos.

Migrado desde el artifact de Claude a un sitio estático (HTML + CSS + JS, sin dependencias ni build).

## Estructura

```
index.html            Página principal
css/theme-institucional.css  Diseño claro (por defecto)
css/theme-cyber.css   Diseño oscuro neón (opcional)
assets/               Logos INNEXA HUB (original, claro y oscuro)
js/config.js          URL y publishable key de Supabase
js/supabase.js        Cliente mínimo de la API REST de Supabase
js/app.js             Lógica del tablero
supabase/schema.sql   Tabla fast_check_ideas + políticas RLS
```

Al cambiar CSS o JS, actualiza el número `?v=` de los `<link>`/`<script>` en `index.html`
para que los navegadores no mezclen archivos nuevos con versiones en caché.

## Diseños

La página trae dos diseños con las mismas clases CSS:

- **Institucional** (`css/theme-institucional.css`): claro y sobrio, el que se ve por defecto.
- **Cyber** (`css/theme-cyber.css`): oscuro con neones, opcional.

El botón de la barra superior cambia entre ambos y cada navegador recuerda su elección.
Los colores de etapas, veredictos y prioridades se definen en cada tema con variables `--k-*`.
Si cambias el diseño o la estructura de la página, revisa ambos archivos.

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

El equipo comparte una sola cuenta y la página solo pide la contraseña
(el correo está fijo en `TEAM_EMAIL` dentro de `js/config.js`):

1. **Authentication → Users → Add user → Create new user**: correo `equipo@fastcheck-innexa.com`,
   la contraseña del equipo (mínimo 6 caracteres) y *Auto Confirm User* marcado.
2. **Authentication → Sign In / Providers → Email**: desactiva *Allow new users to sign up*.

Para cambiar la contraseña: **Authentication → Users → (el usuario) → Reset password / Update user**.
Para usar cuentas individuales, deja `TEAM_EMAIL: ''` y la página pedirá correo y contraseña.
3. Las políticas RLS de `schema.sql` solo permiten leer y escribir a usuarios autenticados,
   así que sin sesión la API no entrega ninguna idea aunque alguien tenga la publishable key.


