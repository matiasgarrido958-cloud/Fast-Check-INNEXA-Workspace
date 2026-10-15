# Fast Check INNEXA — Workspace

Tablero colaborativo para gestionar ideas de fact-checking (Ideas Iniciales → En Discusión → En Proceso → Pendiente Publicación → Publicadas), con datos guardados en **Supabase** y sincronización automática entre usuarios cada 3 segundos.

Migrado desde el artifact de Claude a un sitio estático (HTML + CSS + JS, sin build; la única librería externa es pdfmake, incluida en `js/vendor/`).

## Estructura

```
index.html            Página principal
css/theme-institucional.css  Diseño claro (por defecto)
css/theme-cyber.css   Diseño oscuro neón (opcional)
assets/               Logos INNEXA HUB (original, claro y oscuro)
js/config.js          URL y publishable key de Supabase
js/lineamientos.js    Checklist, tipos de fuente y motivos de descarte
js/supabase.js        Cliente mínimo de la API REST de Supabase
js/prioridad.js       Matriz de priorización automática
js/reporte.js         Reporte formal descargable de cada propuesta (PDF)
js/vendor/            pdfmake (genera el PDF del reporte)
js/investigacion.js   Investigación profunda IA: prompt e importación del informe
js/app.js             Lógica del tablero
supabase/schema.sql   Tabla fast_check_ideas + políticas RLS
supabase/migracion-flujo-etapas.sql  Columnas del flujo por etapas
supabase/migracion-matriz-prioridad.sql  Columnas de la matriz de priorización
supabase/functions/evaluar-prioridad/    Función que evalúa con Gemini
```

Al cambiar CSS o JS, actualiza el número `?v=` de los `<link>`/`<script>` en `index.html`
para que los navegadores no mezclen archivos nuevos con versiones en caché.

## Flujo de trabajo

Basado en los *Lineamientos Fast Check INNEXA v3.0*. Cada idea avanza de a una etapa;
para avanzar debe cumplir los requisitos de la etapa (la página muestra qué falta).
Retroceder siempre se puede.

| Etapa | Qué se completa | Requisito para avanzar |
|---|---|---|
| 1. Ideas Iniciales | Afirmación, quién la dijo, fecha, enlace, alcance, pregunta, categoría, gancho, fuentes iniciales | Afirmación, categoría, autor y 2+ fuentes iniciales |
| 2. En Discusión | Evaluación e investigación: cobertura, verificable, prioridad, responsable, fuentes de verificación (tipo y postura), veredicto, explicación, contexto que falta, checklist de investigación | Filtros marcados, responsable, 2+ fuentes con título y enlace (o excepción), veredicto, explicación y checklist completo |
| 3. En Proceso | Diseño del post de Instagram: hook, puntos clave, diseño, revisor, aprobación del equipo, checklist de publicación | Hook ≤ 10 palabras, puntos clave, revisor distinto del responsable, aprobación y checklist |
| 4. Pendiente Publicación | Cola de posts listos y aprobados, para irlos subiendo de a poco | — |
| 5. Publicadas | Link, fecha, guardados, compartidos, correcciones (Fe de Erratas) | — |

Las ideas que no siguen se **descartan** con un motivo (no se borran) y se pueden restaurar.
Solo desde *Descartadas* se puede eliminar definitivamente.

El checklist de En Discusión (investigación) y de En Proceso (publicación) se marca desde el botón **☑** de la tarjeta (se guarda al marcar).
Checklist, tipos de fuente y motivos se editan en `js/lineamientos.js`. Responsable y revisor se escriben libremente (la página sugiere los nombres ya usados).

## Investigación profunda IA

Solo en **Ideas Iniciales**, el botón **✨ Investigación profunda IA** (arriba a la derecha del formulario)
abre un panel con dos pasos:

1. **Copiar el prompt**: incluye la afirmación y lo que ya se sabe de ella. Se usa en Claude u otra IA.
   Pide un informe (TL;DR, quién lo dijo, fuentes, detalles, advertencias) y, al final, un bloque
   ` ```json ` con un formato fijo. Si ya existe un informe, el mismo prompt sirve para convertirlo.
2. **Pegar la respuesta completa** de la IA.

*Revisar respuesta* muestra qué se leyó y qué faltaría para pasar a En Discusión; *Guardar en la idea*
guarda la información. La idea **no avanza sola**: sigue en Ideas Iniciales (sirve también para ir
almacenando investigaciones) y el equipo la pasa a En Discusión cuando esté seguro. Después, los datos
se corrigen a mano en el formulario.

La afirmación escrita por el equipo no se reemplaza, y el checklist de investigación no se marca solo: el
equipo debe confirmar que cada cifra se comprobó en su fuente original. Las advertencias del informe
quedan en *Contexto que falta*.

## Reporte de la propuesta

Desde **En Discusión** (y en las etapas siguientes) cada idea tiene el botón **⬇ Descargar propuesta**,
arriba a la derecha del formulario. Descarga directamente un PDF A4 (`Propuesta Fast Check 001 - ….pdf`)
con la afirmación, las fuentes de verificación en una tabla compacta, el veredicto y el análisis.
Incluye lo escrito en el formulario aunque todavía no se haya guardado, y los campos vacíos aparecen
como *No informado*. El PDF se arma en el navegador con [pdfmake](https://github.com/bpampuch/pdfmake)
0.2.20 (licencia MIT, en `js/vendor/`), que se carga solo al pedir el primer reporte. El formato se edita
en `js/reporte.js`.

## Matriz de priorización

En **En Discusión** la prioridad se calcula sola (0–100 → Alta ≥ 60, Media ≥ 35, Baja). Gemini evalúa:

| Criterio | Peso |
|---|---|
| Consecuencias si se cree (considerando cuánta gente la ve) | ×3 |
| Circulación y vigencia | ×3 |
| Relevancia (tema y emisor) | ×1 |

Siguen el modelo de daño de Full Fact / Cunliffe-Jones (el daño requiere que suficiente gente la crea) y
el criterio viralidad × peligrosidad de Maldita.es. Reglas adicionales:

- **No amplificar:** si la circulación es 1, la prioridad máxima es Media.
- **Esfuerzo** (bajo ×1, medio ×0,9, alto ×0,75) y **equilibrio** (mismo autor repetido ×0,9) ajustan el puntaje.
- **Verificabilidad**, **potencial comercial** y **demanda** se muestran pero no suman
  (la verificabilidad ya es un filtro que marca el equipo).
- **Señales de alerta:** la IA marca cifras imposibles, datos desactualizados o fuentes que no calzan;
  se muestran en la matriz y en la etapa de investigación.

Sin IA disponible se usan respaldos automáticos y la página lo indica. El equipo puede cambiar la
prioridad final escribiendo el motivo. Pesos, cortes y reglas: `js/lineamientos.js` → `MATRIX`.

### Activar la evaluación con IA (Gemini)

1. Crear una API key en Google AI Studio, en un proyecto propio para Fast Check.
2. Supabase → **Edge Functions → Secrets**: agregar `GEMINI_API_KEY` (y opcionalmente `GEMINI_MODEL`).
3. Supabase → **Edge Functions → Deploy a new function → Via Editor**, nombre `evaluar-prioridad`,
   pegar `supabase/functions/evaluar-prioridad/index.ts` y desactivar *Verify JWT* (la función valida la sesión por sí misma).

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


