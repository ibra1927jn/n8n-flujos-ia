# Tres flujos de n8n con IA

Proyecto de n8n pensado para enseñarlo en clase. Son tres flujos que usan agentes de IA (Google Gemini), Gmail, webhooks y peticiones HTTP. Cada flujo viene en dos versiones: **terminada**, que ya funciona, y **para montar**, con los mismos bloques configurados pero sin unir, para conectarlos arrastrando en directo.

Empieza por [`guia.html`](../guia.html): explica la preparación, cómo probar cada flujo, el guion para el directo y qué hacer si algo falla.

## Los flujos

| Flujo | Qué hace |
|---|---|
| 1 · Recepcionista IA | Una persona escribe en la web de una academia inventada y recibe por correo una respuesta a su medida. Secretaría recibe un aviso con la urgencia y el resumen. Si la IA falla, sale una respuesta de reserva. |
| 2 · Redactor de posts | Escribes un tema en una mini-web, el flujo busca titulares de la última semana y la IA redacta un post para LinkedIn, que aparece en la web y llega por correo. |
| 3 · Resumen de varios Gmail | Cada mañana lee los correos recibidos en dos cuentas de Gmail y envía un único resumen con lo urgente, lo pendiente y lo informativo. |

## Qué hay en cada carpeta

| Ruta | Contenido |
|---|---|
| `guia.html`, `img/` | La guía y sus capturas. |
| `flujos/` | Los seis flujos para importar en n8n (terminado y para montar). |
| `flujos/ensayo-sin-conexion/` | Copias que funcionan sin credenciales: la IA y Gmail llevan datos fijados. |
| `web/` | Las dos páginas de demostración que envían datos a los flujos 1 y 2. |
| `ejemplos/` | Tres correos tal como los montan los flujos. |
| `herramientas/` | El generador de los flujos y la batería de pruebas. |

Los archivos de `flujos/` no llevan credenciales ni claves: se eligen en n8n después de importar.

## Qué está comprobado

- **Comprobado** en n8n 2.42.6, con una IA simulada en local: importar desde el menú, montar las tres versiones «para montar» arrastrando las uniones, ejecutar los tres flujos y los casos de fallo (la IA responde mal, la IA no responde, las noticias no llegan). La batería son 113 comprobaciones.
- **Comprobado** también con respuestas de una IA real en los flujos 1 y 2: el agente de n8n recibió las respuestas de Claude en lugar de las de Gemini. De ahí salen los correos de `ejemplos/`.
- **Sin comprobar:** Gemini y Gmail de verdad, porque dependen de las credenciales de quien lo use.

## Cómo se generan los flujos

Los archivos de `flujos/` y `guia.html` no se editan a mano. Salen de `herramientas/flows.cjs`, que es la única definición de los tres flujos. Para regenerarlos, desde la raíz del repositorio:

```bash
node herramientas/build.cjs . herramientas/pruebas
node herramientas/validate.cjs flujos/*.json flujos/ensayo-sin-conexion/*.json
node herramientas/guide.cjs .
```

`validate.cjs` compara cada bloque con las definiciones de un n8n instalado de forma global con npm.

La batería (`herramientas/pruebas-n8n.mjs`) maneja el editor de un n8n de pruebas aparte, en el puerto 5679, con Microsoft Edge sin ventana. Necesita ese n8n arrancado con `herramientas/run-n8n.cjs`, una cuenta de pruebas creada en él y sus datos de acceso en `herramientas/n8n-demo/ACCESO-DEMO.txt`. Esa carpeta no se guarda en el repositorio.
