// IA SIMULADA para pruebas: imita en local la API de Gemini (no es Gemini ni usa ninguna clave real).
// Responde con reglas sencillas según lo que le llega, para poder ejecutar de verdad el bloque «AI Agent»
// de n8n con su bloque de Gemini y su «Output Parser». Solo escucha en este ordenador.
// Uso: node mock-gemini.cjs [puerto] [archivo-de-registro.jsonl]
const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = Number(process.argv[2] || 8787);
const LOG = process.argv[3];
// MODO BUZÓN: si existe el archivo pruebas/buzon/ACTIVO, la respuesta no sale de las reglas de abajo:
// cada petición del agente se deja en pruebas/buzon/peticion-<id>.json y se espera a que alguien (Claude, en la sesión)
// escriba pruebas/buzon/respuesta-<id>.json con { "objeto": {...} } o { "texto": "..." }.
const BUZON = path.join(__dirname, 'pruebas', 'buzon');
let turno = 0;
const L = (...l) => l.join('\n');
const veces = new Map(); // para los fallos provocados: cuántas veces se ha pedido cada cosa

const anota = (o) => { if (LOG) fs.appendFileSync(LOG, JSON.stringify({ t: new Date().toISOString(), ...o }) + '\n'); };
const uso = { promptTokenCount: 420, candidatesTokenCount: 160, totalTokenCount: 580 };
const deTexto = (t) => ({ candidates: [{ content: { role: 'model', parts: [{ text: t }] }, finishReason: 'STOP', index: 0 }], usageMetadata: uso, modelVersion: 'ia-simulada' });
const deLlamada = (name, args) => ({ candidates: [{ content: { role: 'model', parts: [{ functionCall: { name, args } }] }, finishReason: 'STOP', index: 0 }], usageMetadata: uso, modelVersion: 'ia-simulada' });

// ── Flujo 1: recepcionista ──
function cursosDelSistema(sys) {
  // «· Excel y análisis de datos: 6 semanas, 190 €. Lunes y miércoles de 18:00 a 20:00.»
  const out = [];
  for (const m of sys.matchAll(/^\s*·\s*(.+?):\s*(.+?),\s*([\d.,]+ € ?(?:al mes)?)\.\s*(.+)$/gm)) out.push({ nombre: m[1].trim(), duracion: m[2].trim(), precio: m[3].trim(), horario: m[4].trim().replace(/\.$/, '') });
  return out;
}
function recepcionista(sys, user) {
  const campo = (k) => ((user.match(new RegExp('^' + k + ':[ \\t]*(.*)$', 'm')) || [])[1] || '').trim();
  const nombre = campo('Nombre') || 'hola';
  const cursoElegido = campo('Curso de interés');
  const mensaje = user.includes('Mensaje:') ? user.slice(user.indexOf('Mensaje:') + 8).trim() : '';
  const pila = nombre.split(/\s+/)[0];
  const todo = (cursoElegido + ' ' + mensaje).toLowerCase();
  const cursos = cursosDelSistema(sys);
  const sinAcentos = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const curso = cursos.find((c) => sinAcentos(cursoElegido).includes(sinAcentos(c.nombre).split(' (')[0]))
    || cursos.find((c) => sinAcentos(c.nombre).split(/[ ,()]+/).filter((p) => p.length > 4).some((p) => sinAcentos(mensaje).includes(p)));
  const firma = 'Lucía · Academia Lumen';
  const contacto = 'Si lo prefieres, llámanos al 910 000 000 o pásate por Calle Mayor 12, de lunes a viernes de 9:00 a 14:00 y de 16:00 a 20:00.';
  let categoria; let urgencia = 'normal'; let asunto; let cuerpo; let resumen;
  if (/cobrad|cobro|devol|queja|reclam|no funciona|error en el pago|estafa/.test(todo)) {
    categoria = 'incidencia'; urgencia = 'alta';
    asunto = 'Hemos recibido tu incidencia y la estamos revisando';
    cuerpo = [`Siento mucho lo ocurrido${curso ? ` con el curso de ${curso.nombre}` : ''}. Entiendo que es urgente.`, 'He pasado tu caso a secretaría como prioritario para que lo revisen y te escriban cuanto antes con la solución.', contacto];
    resumen = `Incidencia urgente${curso ? ` en ${curso.nombre}` : ''}: ${mensaje.slice(0, 110)}${mensaje.length > 110 ? '…' : ''} Hay que revisarlo y contestar hoy.`;
  } else if (/matricul|apunt|inscrib|reservar plaza/.test(todo)) {
    categoria = 'matricula';
    asunto = curso ? `Cómo matricularte en ${curso.nombre}` : 'Cómo matricularte en la academia';
    cuerpo = [`Gracias por tu interés${curso ? ` en el curso de ${curso.nombre}` : ''}. Para matricularte solo tienes que contestar a este correo con tus datos o pasarte por secretaría.`, `${curso ? `El curso dura ${curso.duracion} y cuesta ${curso.precio}. ` : ''}La matrícula son 30 €, gratis si la formalizas con más de 15 días de antelación. Los cursos empiezan el primer lunes de cada mes y puedes seguirlos de forma presencial u online en directo.`, contacto];
    resumen = `Quiere matricularse${curso ? ` en ${curso.nombre}` : ''}. Conviene confirmarle plaza y fecha de inicio.`;
  } else if (/cu[aá]nto|cuesta|precio|descuento|vale|tarifa/.test(todo)) {
    categoria = 'precios';
    asunto = curso ? `Precio y horario del curso de ${curso.nombre}` : 'Precios de nuestros cursos';
    const descuento = /paro|desemplead|estudiante/.test(todo) ? ' Además, las personas desempleadas y los estudiantes tienen un 10 % de descuento.' : '';
    cuerpo = [curso ? `Gracias por escribirnos. El curso de ${curso.nombre} dura ${curso.duracion} y cuesta ${curso.precio}. ${curso.horario}.${descuento}` : `Gracias por escribirnos. Nuestros cursos cuestan entre 120 € y 320 €, según la duración.${descuento}`, 'La matrícula son 30 €, gratis si la formalizas con más de 15 días de antelación. Las clases son presenciales u online en directo y quedan grabadas.', 'Si quieres reservar plaza, contesta a este correo o llámanos al 910 000 000.'];
    resumen = `Pregunta por el precio${curso ? ` de ${curso.nombre}` : ''}${descuento ? ' y por descuentos' : ''}. Conviene llamar para reservar plaza.`;
  } else if (/horario|qu[eé] d[ií]as|a qu[eé] hora|cu[aá]ndo empieza/.test(todo)) {
    categoria = 'horarios';
    asunto = curso ? `Horario del curso de ${curso.nombre}` : 'Horarios de la academia';
    cuerpo = [curso ? `El curso de ${curso.nombre} tiene este horario: ${curso.horario}. Dura ${curso.duracion}.` : 'Secretaría abre de lunes a viernes, de 9:00 a 14:00 y de 16:00 a 20:00.', 'Los cursos empiezan el primer lunes de cada mes.', contacto];
    resumen = `Pregunta por horarios${curso ? ` de ${curso.nombre}` : ''}. No requiere más acción.`;
  } else {
    categoria = curso ? 'informacion_cursos' : 'otros';
    asunto = curso ? `Información sobre el curso de ${curso.nombre}` : 'Hemos recibido tu consulta';
    cuerpo = [curso ? `Gracias por tu interés. El curso de ${curso.nombre} dura ${curso.duracion}, cuesta ${curso.precio} y al terminar recibes un certificado de aprovechamiento.` : 'Gracias por escribirnos. Secretaría te escribirá para concretar lo que necesitas.', contacto];
    resumen = `Consulta general${curso ? ` sobre ${curso.nombre}` : ''}: ${mensaje.slice(0, 90)}`;
  }
  return { categoria, urgencia, asunto, respuesta: [`Hola, ${pila}:`, ...cuerpo, firma].join('\n\n'), resumen_interno: resumen, _mensaje: mensaje, _nombre: nombre };
}

// ── Flujo 2: redactor de posts ──
function redactor(user) {
  const tema = ((user.match(/^Tema del post:[ \t]*(.*)$/m) || [])[1] || 'el tema').trim();
  const tono = ((user.match(/^Tono:[ \t]*(.*)$/m) || [])[1] || 'Cercano').trim();
  const titular = ((user.match(/^1\.\s*(.+)$/m) || [])[1] || '').replace(/\s+-\s+[^-]+$/, '').trim();
  const etiqueta = '#' + tema.split(/\s+/).filter((p) => p.length > 3).slice(0, 2).map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase()).join('').normalize('NFD').replace(/[^\w]/g, '');
  return L(
    `¿Y si ${tema.toLowerCase()} fuera más sencillo de lo que parece?`,
    '',
    titular ? `Esta semana se habla de ello: «${titular}». Y no es casualidad.` : 'Cada semana aparecen novedades y es fácil sentir que vamos tarde.',
    '',
    'La pregunta importante no es qué herramienta usar, sino para qué. Quien tiene claro el objetivo avanza más rápido que quien prueba todo.',
    '',
    'Mi consejo para empezar: elige una sola tarea repetitiva de tu semana y cámbiala. Mide el tiempo que ahorras y decide después.',
    '',
    `Lo cuento con un tono ${tono.toLowerCase()} porque lo importante es que se entienda y se pueda aplicar mañana mismo.`,
    '',
    '¿Cuál sería esa primera tarea en tu caso?',
    '',
    `${etiqueta} #Productividad #Aprendizaje`,
  );
}

// ── Flujo 3: resumen de correos ──
function analista(user) {
  const i = user.indexOf('['); const j = user.lastIndexOf(']');
  let correos = [];
  try { correos = JSON.parse(user.slice(i, j + 1)); } catch { return '<p>No he podido leer la lista de correos.</p>'; }
  const cuentas = [...new Set(correos.map((c) => c.cuenta))];
  const quien = (de) => String(de || 'Alguien').replace(/<.*>/, '').trim() || 'Alguien';
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let urgentes = 0;
  const bloques = cuentas.map((cuenta) => {
    const suyos = correos.filter((c) => c.cuenta === cuenta && c.asunto !== '(sin correos nuevos)');
    if (!suyos.length) return `<h3>${esc(cuenta)}</h3>\n<p>Sin novedades</p>`;
    const grupo = { Urgente: [], 'Pendiente de responder': [], 'Para tu información': [] };
    for (const c of suyos) {
      const t = (c.asunto + ' ' + c.extracto).toLowerCase();
      const k = /hoy|urgente|mañana|antes de las|vence|último día/.test(t) ? 'Urgente' : /\?|confirma|dime|propón|respóndeme|te va bien/.test(t) ? 'Pendiente de responder' : 'Para tu información';
      if (k === 'Urgente') urgentes++;
      grupo[k].push(`<li>${esc(quien(c.de))}: ${esc(c.asunto)}.</li>`);
    }
    return [`<h3>${esc(cuenta)}</h3>`, ...Object.entries(grupo).filter(([, v]) => v.length).map(([k, v]) => `<p><strong>${k}</strong></p>\n<ul>${v.join('')}</ul>`)].join('\n');
  });
  const total = correos.filter((c) => c.asunto !== '(sin correos nuevos)').length;
  return [`<p>Tienes ${total} correos nuevos en ${cuentas.length} cuentas; ${urgentes ? `${urgentes} piden atención hoy` : 'ninguno es urgente'}.</p>`, ...bloques].join('\n');
}

function leer(body) {
  const sys = (body.systemInstruction?.parts || []).map((p) => p.text || '').join('\n');
  const users = (body.contents || []).filter((c) => c.role === 'user');
  const user = (users[users.length - 1]?.parts || []).map((p) => p.text || '').join('\n');
  const funciones = (body.tools || []).flatMap((t) => t.functionDeclarations || []);
  const salida = funciones.find((f) => f.name === 'format_final_json_response');
  const info = { sistema: sys.length, usuario: user.slice(0, 160), herramientas: funciones.map((f) => f.name), mensajes: (body.contents || []).length };
  return { sys, user, funciones, salida, info };
}

// Modo buzón: deja la petición en un archivo y espera la respuesta escrita desde fuera.
async function porBuzon(body) {
  const { sys, user, salida, info } = leer(body);
  const id = `${Date.now()}-${++turno}`;
  const flujo = /recepcionista virtual de Academia Lumen/.test(sys) ? 1 : /redactor experto en LinkedIn/.test(sys) ? 2 : /revisa varias cuentas de Gmail/.test(sys) ? 3 : 'desconocido';
  const generacion = body.generationConfig || null;
  fs.writeFileSync(path.join(BUZON, `peticion-${id}.json`), JSON.stringify({ id, flujo, formato: salida ? salida.name : null, esquema: salida ? salida.parameters : null, generacion, sistema: sys, usuario: user }, null, 2));
  const f = path.join(BUZON, `respuesta-${id}.json`);
  const fin = Date.now() + 270000;
  while (Date.now() < fin) {
    if (fs.existsSync(f)) {
      try {
        const resp = JSON.parse(fs.readFileSync(f, 'utf8'));
        if (salida && resp.objeto) {
          const esquema = salida.parameters || {};
          const args = esquema.properties && esquema.properties.output ? { output: resp.objeto } : resp.objeto;
          return { info: { ...info, flujo, via: 'Claude · herramienta de salida' }, json: deLlamada(salida.name, args) };
        }
        return { info: { ...info, flujo, via: 'Claude · texto' }, json: deTexto(resp.texto != null ? String(resp.texto) : JSON.stringify(resp.objeto)) };
      } catch (e) { /* archivo a medio escribir: se vuelve a mirar */ }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return { estado: 503, info: { ...info, flujo, provocado: 'buzón sin respuesta' }, json: { error: { code: 503, message: 'Nadie ha contestado a tiempo en el buzón', status: 'UNAVAILABLE' } } };
}

function responder(body) {
  const { sys, user, funciones, salida, info } = leer(body);

  if (/recepcionista virtual de Academia Lumen/.test(sys)) {
    const r = recepcionista(sys, user);
    const mensaje = r._mensaje; const clave = r._nombre + '|' + mensaje; delete r._mensaje; delete r._nombre;
    const n = (veces.get(clave) || 0) + 1; veces.set(clave, n);
    if (/\[prueba:error-siempre\]/.test(mensaje)) return { estado: 503, info: { ...info, flujo: 1, provocado: 'error en todos los intentos' }, json: { error: { code: 503, message: 'Fallo provocado por la prueba: la IA no está disponible', status: 'UNAVAILABLE' } } };
    if (/\[prueba:error-500\]/.test(mensaje) && n === 1) return { estado: 500, info: { ...info, flujo: 1, provocado: 'error 500' }, json: { error: { code: 500, message: 'Fallo provocado por la prueba', status: 'INTERNAL' } } };
    if (/\[prueba:json-roto\]/.test(mensaje) && n === 1) return { info: { ...info, flujo: 1, provocado: 'salida sin formato' }, json: deTexto('Claro, aquí tienes la respuesta: no soy un JSON válido {') };
    if (salida) {
      const esquema = salida.parameters || {};
      const args = esquema.properties && esquema.properties.output ? { output: r } : r;
      return { info: { ...info, flujo: 1, via: 'herramienta de salida', envuelto: !!(esquema.properties && esquema.properties.output) }, json: deLlamada(salida.name, args) };
    }
    return { info: { ...info, flujo: 1, via: 'texto' }, json: deTexto('```json\n' + JSON.stringify(r, null, 2) + '\n```') };
  }
  if (/redactor experto en LinkedIn/.test(sys)) return { info: { ...info, flujo: 2 }, json: deTexto(redactor(user)) };
  if (/revisa varias cuentas de Gmail/.test(sys)) return { info: { ...info, flujo: 3 }, json: deTexto('```html\n' + analista(user) + '\n```') };
  return { info: { ...info, flujo: 'desconocido' }, json: deTexto('Soy una IA simulada de pruebas y no reconozco esta petición.') };
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && /^\/v1(beta)?\/models\/?$/.test(url.pathname)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ models: ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'].map((m) => ({ name: 'models/' + m, displayName: m + ' (simulado)', supportedGenerationMethods: ['generateContent', 'streamGenerateContent'] })) }));
    return;
  }
  const m = url.pathname.match(/^\/v1(?:beta)?\/models\/([^:]+):(generateContent|streamGenerateContent)$/);
  if (req.method !== 'POST' || !m) { anota({ ruta: req.method + ' ' + req.url, estado: 404 }); res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { code: 404, message: 'ruta no simulada' } })); return; }
  let raw = '';
  req.on('data', (d) => { raw += d; });
  req.on('end', async () => {
    let body = {};
    try { body = JSON.parse(raw); } catch {}
    const r = fs.existsSync(path.join(BUZON, 'ACTIVO')) ? await porBuzon(body) : responder(body);
    anota({ modelo: m[1], metodo: m[2], estado: r.estado || 200, ...r.info });
    if (m[2] === 'streamGenerateContent') {
      res.writeHead(r.estado || 200, { 'Content-Type': r.estado ? 'application/json' : 'text/event-stream' });
      res.end(r.estado ? JSON.stringify(r.json) : `data: ${JSON.stringify(r.json)}\n\n`);
    } else {
      res.writeHead(r.estado || 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(r.json));
    }
  });
}).listen(PORT, '127.0.0.1', () => console.log(`IA simulada escuchando en http://127.0.0.1:${PORT}`));
