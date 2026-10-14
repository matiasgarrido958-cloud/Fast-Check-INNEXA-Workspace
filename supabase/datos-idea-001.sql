-- Carga la idea 001 ("La IA va a reemplazar a todos los ingenieros en 5 años")
-- con la investigación completa y la deja en la etapa En Proceso.
-- Ejecutar en Supabase: Dashboard → SQL Editor → New query → pegar todo → Run.
-- Si la idea 001 ya existe, se actualiza; si no, se crea.

insert into public.fast_check_ideas (
    id, title, category, status, claim_author, claim_date, claim_url, scope, question, gancho, initial_sources, in_coverage, is_verifiable, circulates, owner, sources, single_source_exception, verdict, analysis, missing_context, checklist, priority, priority_score, source, last_edited_by, last_edited_at
) values (
    $fc$001$fc$,
    $fc$La IA va a reemplazar a todos los ingenieros en 5 años$fc$,
    $fc$IA$fc$,
    $fc$working$fc$,
    $fc$Paráfrasis viral sin autor único verificable. Origen más cercano: Dario Amodei, CEO de Anthropic (Davos, enero 2026), recogido en Chile por BioBioChile; y Elon Musk ("para finales de 2026 ya ni siquiera habrá que preocuparse por programar"), recogido por Página 7$fc$,
    $fc$2026-01-21$fc$,
    $fc$https://www.biobiochile.cl/noticias/economia/actualidad-economica/2026/01/19/la-elite-global-regresa-al-conclave-del-foro-economico-mundial-de-davos-con-la-vista-puesta-en-trump.shtml$fc$,
    $fc$Global en su origen (EE.UU./Davos), con repercusión en Chile. Sector: tecnología/software y profesiones de ingeniería en general. Población: ingenieros, programadores y desarrolladores de software, sobre todo recién egresados y perfiles junior (menores de 30 años).$fc$,
    $fc$¿Hay evidencia de que la IA esté eliminando empleos de ingenieros y programadores en Chile, o solo está reduciendo la contratación de perfiles junior? Es decir: ¿cayó el número de ingenieros/desarrolladores ocupados entre 2024 y 2026, o lo que cae es la contratación de recién egresados?$fc$,
    $fc$El desempleo de profesionales en Chile llegó a 8,3%, y a 15,9% entre los titulados menores de 30 (OCEC-UDP, octubre 2026). El Banco Central incluyó la automatización y la IA entre las causas persistentes del alto desempleo (IPoM de septiembre 2026).

Además, el plazo de "6 a 12 meses" que dio Amodei en Davos para que la IA haga el trabajo de los ingenieros de software se cumple entre julio de 2026 y enero de 2027, así que es el momento de contrastarlo con los datos. Contrapunto: los avisos para desarrolladores de software en Chile alcanzaron un récord (5.387 en el primer semestre de 2026, SENCE).$fc$,
    $fc$[
 {
  "ref": "https://www.biobiochile.cl/noticias/economia/actualidad-economica/2026/01/19/la-elite-global-regresa-al-conclave-del-foro-economico-mundial-de-davos-con-la-vista-puesta-en-trump.shtml"
 },
 {
  "ref": "https://www.df.cl/opinion/columnistas/inteligencia-artificial-y-empleo"
 },
 {
  "ref": "https://www.diarioestrategia.cl/texto-diario/mostrar/6013926/dia-programador-ia-cambia-reglas-desarrolladores-pero-chile-no-acaba-demanda"
 },
 {
  "ref": "https://www.emol.com/noticias/Economia/2026/09/10/1211140/anthropic-impacto-ia.html"
 },
 {
  "ref": "https://www.cnnchile.com/negocios/banco-central-debilidad-empleo-salario-minimo-jornada-laboral-automatizacion/"
 },
 {
  "ref": "https://www.latercera.com/pulso/noticia/como-la-vertiginosa-expansion-de-la-inteligencia-artificial-amenaza-al-mercado-laboral-en-chile/"
 }
]$fc$::jsonb,
    true,
    true,
    true,
    $fc$Por asignar$fc$,
    $fc$[
 {
  "title": "La élite global regresa al 'cónclave' del Foro Económico Mundial de Davos con la vista puesta en Trump",
  "author": "BioBioChile (Economía)",
  "url": "https://www.biobiochile.cl/noticias/economia/actualidad-economica/2026/01/19/la-elite-global-regresa-al-conclave-del-foro-economico-mundial-de-davos-con-la-vista-puesta-en-trump.shtml",
  "year": "2026",
  "type": "medio",
  "stance": "respalda",
  "notes": "19 ene 2026. Recoge que Amodei afirma que la IA podría eliminar la mitad de los empleos administrativos de nivel inicial en uno a cinco años. Respalda solo parcialmente: coincide en el plazo, pero se limita a empleos de entrada y a la mitad, no a todos los ingenieros."
 },
 {
  "title": "Anthropic calcula el impacto de la IA a 2030: El PIB se dispara y un desempleo masivo golpea a los profesionales",
  "author": "Emol — José Tomás Guzmán",
  "url": "https://www.emol.com/noticias/Economia/2026/09/10/1211140/anthropic-impacto-ia.html",
  "year": "2026",
  "type": "medio",
  "stance": "contexto",
  "notes": "10 sep 2026. Tres escenarios de Anthropic a 2030: en el extremo, el desempleo de trabajadores del conocimiento llega a 18% (EE.UU.); en los moderados, 2,9%–4,5%. Ni en el peor escenario se proyecta un reemplazo total. Limitación: son escenarios modelados por una empresa interesada, no hechos, y con datos de EE.UU."
 },
 {
  "title": "Inteligencia artificial y empleo (columna)",
  "author": "Claudia Martínez, directora del Instituto de Economía UC — Diario Financiero",
  "url": "https://www.df.cl/opinion/columnistas/inteligencia-artificial-y-empleo",
  "year": "2026",
  "type": "experto",
  "stance": "contradice",
  "notes": "6 ago 2026. Comenta el paper NBER \"AI-Assisted Programming and Labor Demand\" (Raymond y Dillon, 2026): en empresas que adoptaron GitHub Copilot for Enterprise la contratación de ingenieros cayó 36% y la de juniors de programación 45%, sin aumento de despidos. Mejor evidencia causal disponible. Limitación: la muestra son multinacionales clientes de Microsoft."
 },
 {
  "title": "Cómo la vertiginosa expansión de la inteligencia artificial amenaza al mercado laboral en Chile",
  "author": "Julio Nahuelhual — La Tercera (Pulso)",
  "url": "https://www.latercera.com/pulso/noticia/como-la-vertiginosa-expansion-de-la-inteligencia-artificial-amenaza-al-mercado-laboral-en-chile/",
  "year": "2026",
  "type": "medio",
  "stance": "contexto",
  "notes": "5 jul 2026. Expertos, gobierno y Banco Central ven señales de efecto de la IA en trabajos de oficina y jóvenes. Cita el estudio Stanford–Sofofa–Cenia, que incluye a desarrolladores entre las ocupaciones más expuestas. Carmen Cifuentes (Clapes UC): \"no existe evidencia concluyente\" de que el mayor desempleo responda principalmente a la IA; más bien habrá \"una menor intensidad en la creación de nuevos puestos\"."
 },
 {
  "title": "Día del Programador: la IA cambia las reglas para los desarrolladores, pero en Chile no acaba con su demanda",
  "author": "Diario Estrategia (EstrategiaTech)",
  "url": "https://www.diarioestrategia.cl/texto-diario/mostrar/6013926/dia-programador-ia-cambia-reglas-desarrolladores-pero-chile-no-acaba-demanda",
  "year": "2026",
  "type": "medio",
  "stance": "contradice",
  "notes": "14 sep 2026. SENCE (sistema SABE): 5.387 avisos para desarrolladores de software en el 1S 2026; por primera vez una ocupación digital entra entre las 20 más demandadas, con mediana salarial de $1,3 millones (+3,8% real). Ariel Hitner (Softtek): el mercado es más desafiante para perfiles junior. Dato chileno que más claramente contradice la afirmación."
 },
 {
  "title": "Aumento del sueldo mínimo, reducción de jornada laboral y automatización: Los factores que identifica el Banco Central en la debilidad del empleo",
  "author": "CNN Chile (Negocios) — presentación de Elías Albagli, Banco Central",
  "url": "https://www.cnnchile.com/negocios/banco-central-debilidad-empleo-salario-minimo-jornada-laboral-automatizacion/",
  "year": "2026",
  "type": "medio",
  "stance": "contexto",
  "notes": "Sep 2026. Entre 2022 y 2025, trabajadores en ocupaciones más expuestas a automatización tuvieron una probabilidad \"alrededor de 21%\" menor de mantener empleo formal (\"aproximadamente 27%\" en menores de 30). El propio BC advierte que son correlaciones, no efecto causal, y la exposición se concentra en ocupaciones elementales, no en profesionales. La nota no indica la fecha exacta."
 },
 {
  "title": "La IA no matará a los ingenieros que entienden el territorio (columna)",
  "author": "Dr. Ing. Marcelo Caverlotti Silva, Universidad de Santiago de Chile — Diario Estrategia",
  "url": "https://www.diarioestrategia.cl/texto-diario/mostrar/6003802/ia-no-matara-ingenieros-entienden-territorio",
  "year": "2026",
  "type": "experto",
  "stance": "contradice",
  "notes": "4 sep 2026. Responde directamente a los titulares de reemplazo: \"La IA probablemente no reemplazará al ingeniero, pero un ingeniero que sepa utilizarla tendrá enormes ventajas\". Limitación: es una opinión desde la ingeniería geoespacial, no la de software."
 }
]$fc$::jsonb,
    $fc$$fc$,
    $fc$engañoso$fc$,
    $fc$No hay evidencia que respalde la afirmación literal. Ningún medio chileno ni líder tecnológico citado en Chile dijo que "todos los ingenieros" serán reemplazados en 5 años. La frase exagera dos predicciones reales de Dario Amodei (CEO de Anthropic): que la IA podría eliminar la mitad de los empleos de oficina de nivel inicial en 1 a 5 años, y que en "6 a 12 meses" los modelos podrían hacer "la mayor parte, tal vez todo" del trabajo de un ingeniero de software. Son predicciones de un ejecutivo con interés comercial, no hechos.

Los datos chilenos de 2026 apuntan en otra dirección: los avisos para desarrolladores llegaron a 5.387 en el primer semestre (SENCE), con salarios reales al alza. Lo que sí se observa es que la puerta de entrada se estrecha: el desempleo de titulados menores de 30 subió a 15,9% y la mejor evidencia causal disponible (NBER, 2026) muestra caídas de 36% en la contratación de ingenieros y de 45% en la de juniors de programación en empresas que adoptaron asistentes de código, sin aumento de despidos.

El veredicto es Engañoso: hay un fenómeno real (la IA automatiza tareas de programación y frena la contratación junior), pero la afirmación lo convierte en un reemplazo total, con un plazo y un alcance que nadie sostuvo.$fc$,
    $fc$La afirmación confunde "automatizar tareas de código" con "reemplazar a todos los ingenieros", y confunde menor contratación de recién egresados con pérdida de empleos existentes. Además extiende un fenómeno del software a toda la ingeniería (civil, minas, industrial), donde no hay evidencia de algo así. Omite que Amodei habló de empleos de oficina de nivel inicial (no de ingenieros) y de la mitad (no de todos), y que el Banco Central advierte que sus cifras de automatización son correlaciones, no causalidad. Chile no tiene datos oficiales que desagreguen el empleo de ingenieros o desarrolladores por efecto de la IA: para responder la pregunta con precisión habría que pedir datos a INE, SENCE o mifuturo.cl.$fc$,
    $fc${
 "fuentes": true,
 "origen": true,
 "calidad": true,
 "contraria": true,
 "datos": false,
 "neutral": true,
 "citadas": true
}$fc$::jsonb,
    $fc$medium$fc$,
    51,
    $fc$https://www.biobiochile.cl/noticias/economia/actualidad-economica/2026/01/19/la-elite-global-regresa-al-conclave-del-foro-economico-mundial-de-davos-con-la-vista-puesta-en-trump.shtml$fc$,
    $fc$Equipo$fc$,
    now()
)
on conflict (id) do update set
    title = excluded.title,
    category = excluded.category,
    status = excluded.status,
    claim_author = excluded.claim_author,
    claim_date = excluded.claim_date,
    claim_url = excluded.claim_url,
    scope = excluded.scope,
    question = excluded.question,
    gancho = excluded.gancho,
    initial_sources = excluded.initial_sources,
    in_coverage = excluded.in_coverage,
    is_verifiable = excluded.is_verifiable,
    circulates = excluded.circulates,
    owner = excluded.owner,
    sources = excluded.sources,
    single_source_exception = excluded.single_source_exception,
    verdict = excluded.verdict,
    analysis = excluded.analysis,
    missing_context = excluded.missing_context,
    checklist = excluded.checklist,
    priority = excluded.priority,
    priority_score = excluded.priority_score,
    source = excluded.source,
    last_edited_by = excluded.last_edited_by,
    last_edited_at = excluded.last_edited_at;
