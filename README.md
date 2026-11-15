# Flujos de n8n con inteligencia artificial

Tres automatizaciones ya hechas para **n8n** (un programa gratuito para conectar aplicaciones entre sí). Usan una IA (Google Gemini) y Gmail.

| Flujo | Qué hace |
|---|---|
| **1 · Recepcionista IA** | Alguien escribe en la web de una academia (inventada) y recibe por correo una respuesta hecha a su medida. Secretaría recibe un aviso con el resumen y la urgencia. |
| **2 · Redactor de posts** | Escribes un tema, el flujo busca noticias de la última semana y la IA redacta un post para LinkedIn. |
| **3 · Resumen de varios Gmail** | Cada mañana lee los correos de dos cuentas de Gmail y te manda un único resumen: lo urgente, lo pendiente y lo informativo. |

Cada flujo viene en tres versiones:

- **terminado**: completo, listo para usar en cuanto conectes Gmail y Gemini.
- **para montar**: las piezas están puestas pero sin unir, para unirlas tú en directo (por ejemplo, en una clase).
- **ensayo sin conexión**: funciona **ya**, sin conectar nada. La IA y Gmail llevan respuestas de ejemplo. Sirve para ver cómo va.

---

## Cómo empezar (ordenador con Windows)

1. Arriba en esta página, pulsa el botón verde **Code** y después **Download ZIP**.
2. Abre la carpeta de Descargas, haz clic derecho en el ZIP y elige **Extraer todo** → **Extraer**.
3. En la carpeta que sale, haz **doble clic en `ABRIR-N8N`**.
   - Si Windows avisa de que «protegió su PC», pulsa **Más información** → **Ejecutar de todas formas**.
   - Si es la primera vez y falta un programa (Node.js), se instala solo. Cuando acabe, vuelve a hacer doble clic en `ABRIR-N8N`.
4. La primera vez tarda **entre 5 y 10 minutos** (descarga n8n y carga los flujos). Las siguientes veces, menos de un minuto.
5. Se abre el navegador con n8n. La primera vez te pide crear una cuenta: pon tu nombre, un correo y una contraseña. Esa cuenta solo existe en tu ordenador.
6. Ya está. Verás los 9 flujos en la lista.

**Mientras uses n8n, deja abierta la ventana negra.** Para apagarlo, ciérrala. Para volver otro día, doble clic otra vez en `ABRIR-N8N`.

## Probar sin conectar nada

1. Abre **«1 · Recepcionista IA (ensayo sin conexión)»**.
2. Pulsa el botón naranja **Execute workflow**.
3. En la carpeta, abre `web` → `contacto-academia.html` con doble clic. Pulsa el ejemplo **Precios** y envía.
4. En la web aparece la respuesta, y en n8n verás todas las piezas en verde.

La guía completa, con capturas y qué hacer si algo falla, está en **`guia.html`** (ábrela con doble clic).

---

## Más adelante: conectar Gmail y Gemini

Ahora mismo **no hay ninguna cuenta conectada**. Los archivos no llevan contraseñas ni claves. Cuando quieras usar los flujos de verdad:

**1. La IA (Gemini)** — gratis con una cuenta de Google:
1. Entra en https://aistudio.google.com/apikey y pulsa **Create API key**. Copia la clave.
2. En n8n, abre un flujo «terminado» y haz doble clic en la pieza **Gemini**.
3. En **Credential**, elige **Create new credential**, pega la clave y pulsa **Save**.

**2. Gmail:**
1. En n8n, haz doble clic en una pieza de Gmail (por ejemplo, **Avisar a secretaría**).
2. En **Credential**, elige **Create new credential**. n8n pide un *Client ID* y un *Client Secret* de Google; la guía de n8n explica cómo sacarlos paso a paso: https://docs.n8n.io/integrations/builtin/credentials/google/oauth-single-service/
3. Pulsa **Sign in with Google** y elige tu cuenta.
4. En las demás piezas de Gmail, elige esa misma credencial en el desplegable.
5. Donde ponga `TU_CORREO@gmail.com`, escribe tu correo.

Para el flujo 3 (dos cuentas), repite el paso 2 en **Leer cuenta 2** con la segunda cuenta de Gmail.

> Consejo: haz la primera prueba con una cuenta de Gmail de pruebas, no con la personal.

---

## Qué hay en la carpeta

| Carpeta / archivo | Para qué sirve |
|---|---|
| `ABRIR-N8N` | Arranca n8n con un doble clic. |
| `guia.html` | Guía completa con capturas. |
| `flujos/` | Los flujos (se cargan solos la primera vez). |
| `web/` | Las dos páginas de prueba de los flujos 1 y 2. |
| `ejemplos/` | Cómo quedan los correos que envían los flujos. |
| `datos-n8n/` | Se crea al arrancar: aquí guarda n8n tus flujos y cuentas. No la borres. |
| `herramientas/` | Solo para quien quiera modificar los flujos ([detalles técnicos](herramientas/LEEME-TECNICO.md)). |
