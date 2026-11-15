// Batería de pruebas de los flujos en el n8n de pruebas, manejando el editor de verdad.
// Uso: node pruebas-n8n.mjs <carpeta-capturas> [simulacros,ia,ensayo,montaje,importar]
import fs from 'node:fs';
import path from 'node:path';
import { SP, N8N, WEB, CONEXION, sleep, abrirNavegador, cerrarNavegador, pestana, entrar, abrir, encajar, ejecutar, aLaEscucha, exito, estadoNodos, avisos, idDe, ultimaEjecucion, NODOS, evento, tomarEdicion, bd } from './cdp.mjs';

const OUT = path.resolve(process.argv[2] || path.join(SP, 'capturas2'));
const QUE = new Set((process.argv[3] || 'simulacros,ia,ensayo,montaje,importar').split(','));
const PROY = process.argv[4] ? path.resolve(process.argv[4]) : null;
const CORREO = 'ana.garcia@example.com';
const res = [];
let grupo = '';
const ok = (nombre, cond, detalle = '') => { res.push({ grupo, nombre, ok: !!cond, detalle }); console.log(`  ${cond ? '✓' : '✗ FALLA'} ${nombre}${detalle ? ' — ' + String(detalle).slice(0, 260) : ''}`); };
const bloque = async (titulo, fn) => { grupo = titulo; console.log('\n▸ ' + titulo); try { await fn(); } catch (e) { ok('se completa sin errores', false, e.message); } };

// Ejecuta un flujo en modo prueba desde el editor y le envía una petición como haría la web.
async function conWebhook(n, id, ruta, datos, minimo = 5, metodo = 'POST') {
  if (!(await n.js(`location.pathname.endsWith('/${id}')`))) await abrir(n, id, minimo);
  await n.frente();
  await ejecutar(n);
  await aLaEscucha(n);
  await sleep(700);
  const r = metodo === 'GET' ? await fetch(`${N8N}/webhook-test/${ruta}`) : await fetch(`${N8N}/webhook-test/${ruta}`, { method: 'POST', body: new URLSearchParams(datos) });
  let json = null; let texto = '';
  try { texto = await r.text(); json = JSON.parse(texto); } catch {}
  await n.esperar(`!document.title.startsWith('🔄')`, 60000, 'el final de la ejecución').catch(() => {});
  await sleep(900);
  return { status: r.status, json, texto };
}

async function enviarContacto(web, ejemplo, extra = '') {
  await web.frente();
  await web.ir(`${WEB}/contacto-academia.html${CONEXION}`);
  await web.esperar(`!!document.querySelector('[data-ejemplo="${ejemplo}"]')`);
  await web.clic(`document.querySelector('[data-ejemplo="${ejemplo}"]')`);
  if (extra) await web.js(`(document.getElementById('mensaje').value += ' ' + ${JSON.stringify(extra)}, 1)`);
  await web.js(`(document.getElementById('email').value = '', 1)`);
  await web.clic(`document.getElementById('email')`);
  await web.escribir(CORREO);
  await web.clic(`document.getElementById('enviar')`);
  await web.esperar(`!document.getElementById('vista-exito').hidden || !document.getElementById('aviso').hidden`, 60000, 'respuesta en la página de contacto');
  await sleep(400);
  return web.js(`({ exito: !document.getElementById('vista-exito').hidden, aviso: document.getElementById('aviso').hidden ? '' : document.getElementById('aviso').textContent, titulo: document.getElementById('ex-titulo').textContent, categoria: document.getElementById('ex-categoria').textContent, urgencia: document.getElementById('ex-urgencia').textContent, asunto: document.getElementById('ex-asunto').textContent, correoVisible: !document.getElementById('ex-correo').hidden, respuesta: document.getElementById('ex-respuesta').textContent, reserva: !document.getElementById('ex-reserva').hidden, clasificacionVisible: !document.getElementById('ex-ia').hidden })`);
}

// Los archivos que se entregan, para comprobar en ellos lo que no se ve al ejecutar.
const entregable = (k, variante) => {
  const dir = variante === 'ensayo' ? path.join(PROY, 'flujos', 'ensayo-sin-conexion') : path.join(PROY, 'flujos');
  const f = fs.readdirSync(dir).find((x) => x.startsWith(k + '-') && x.endsWith(`-${variante}.json`));
  return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
};
const bloque1 = (wf, nombre) => wf.nodes.find((x) => x.name === nombre);
const sigue = (wf, de) => (wf.connections[de]?.main?.[0] || []).map((c) => c.node).join(',');

async function enviarRedactor(web, tema) {
  await web.frente();
  await web.ir(`${WEB}/redactor-posts.html${CONEXION}`);
  await web.esperar(`!!document.getElementById('tema')`);
  await web.clic(`document.getElementById('tema')`);
  await web.escribir(tema);
  await web.js(`(document.getElementById('email').value = '', 1)`);
  await web.clic(`document.getElementById('email')`);
  await web.escribir(CORREO);
  await web.clic(`document.getElementById('enviar')`);
  await web.esperar(`!document.getElementById('resultado').hidden || !document.getElementById('aviso').hidden`, 70000, 'el post en la mini-web');
  await sleep(400);
  return web.js(`({ exito: !document.getElementById('resultado').hidden, aviso: document.getElementById('aviso').hidden ? '' : document.getElementById('aviso').textContent, post: document.getElementById('texto').textContent, fuentes: document.querySelectorAll('#fuentes li').length, enviado: document.getElementById('enviado').textContent })`);
}

const registroIA = () => { try { return fs.readFileSync(path.join(SP, 'pruebas', 'ia-simulada.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };

try {
  await abrirNavegador();
  const n = await pestana(1600, 900, 1.5, OUT);
  const web = await pestana(1280, 900, 1.5, OUT);
  await entrar(n);
  console.log('sesión iniciada en el n8n de pruebas');

  // ───────── 1. Simulacros: mismas expresiones que los flujos reales, sin IA ni Gmail ─────────
  if (QUE.has('simulacros')) {
    const S1 = idDe('[PRUEBA] 1'); const S2 = idDe('[PRUEBA] 2'); const S3 = idDe('[PRUEBA] 3');
    await bloque('Recepcionista · consulta normal', async () => {
      const r = await conWebhook(n, S1, 'recepcionista', { nombre: 'Ana García', email: CORREO, curso: 'Excel y análisis de datos', mensaje: '¿Cuánto cuesta el curso?' }, 3);
      ok('la web recibe respuesta correcta', r.status === 200 && r.json?.ok === true, `estado ${r.status}`);
      ok('la respuesta trae el texto del correo para enseñarlo en la web', typeof r.json?.respuesta === 'string' && r.json.respuesta.includes('Ana García'));
      ok('la web sabe que ha respondido la IA', r.json?.respondio_la_ia === true);
      const p = r.json?._prueba || {};
      ok('correo al alumno: destinatario y saltos de línea', p.correoAlumno?.sendTo === CORREO && /<br>/.test(p.correoAlumno?.message || ''));
      ok('aviso a secretaría: asunto con la urgencia', /^\[NORMAL\] Nueva consulta de Ana García$/.test(p.correoSecretaria?.subject || ''), p.correoSecretaria?.subject);
      ok('aviso a secretaría: dice que la respuesta es de la IA', /Respuesta de la recepcionista IA/.test(p.correoSecretaria?.message || ''));
    });
    await bloque('Recepcionista · la IA no responde: respuesta de reserva', async () => {
      const r = await conWebhook(n, S1, 'recepcionista', { nombre: 'Ana García', email: CORREO, curso: 'Excel y análisis de datos', mensaje: '¿Cuánto cuesta el curso?', _sinIA: '1' }, 3);
      ok('el flujo no se detiene y la web recibe respuesta', r.status === 200 && r.json?.ok === true, `estado ${r.status} ${r.texto.slice(0, 140)}`);
      ok('la web sabe que NO ha respondido la IA', r.json?.respondio_la_ia === false);
      ok('la persona recibe la respuesta de reserva, con su nombre', /^Hola, Ana García:/.test(r.json?.respuesta || '') && /Hemos recibido tu consulta/.test(r.json?.respuesta || ''), (r.json?.respuesta || '').slice(0, 70).replace(/\n/g, ' '));
      const p = r.json?._prueba || {};
      ok('el correo al alumno sale igualmente', p.correoAlumno?.sendTo === CORREO && p.correoAlumno?.subject === 'Hemos recibido tu consulta', p.correoAlumno?.subject);
      ok('secretaría recibe el aviso como urgente', /^\[ALTA\] Nueva consulta de Ana García$/.test(p.correoSecretaria?.subject || ''), p.correoSecretaria?.subject);
      ok('y el aviso explica que la IA no ha respondido y que hay que contestar a mano', /La IA no ha podido responder/.test(p.correoSecretaria?.message || '') && /hay que contestar a mano/.test(p.correoSecretaria?.message || '') && /Respuesta de reserva/.test(p.correoSecretaria?.message || ''));
      ok('el aviso conserva la consulta original', /¿Cuánto cuesta el curso\?/.test(p.correoSecretaria?.message || ''));
    });
    await bloque('Recepcionista · petición sin nombre ni curso y con un mensaje larguísimo', async () => {
      const r = await conWebhook(n, S1, 'recepcionista', { email: CORREO, mensaje: 'A'.repeat(1990) + 'FRONTERA' + 'B'.repeat(3000) }, 3);
      ok('no falla', r.status === 200 && r.json?.ok === true, `estado ${r.status} ${r.texto.slice(0, 120)}`);
      await sleep(1200);
      const e = await ultimaEjecucion(S1);
      const prompt = e?.salida?.['Recepcionista IA']?.items?.[0]?.prompt || '';
      ok('a la IA le llega «no indicado» en lo que falta, nunca «undefined»', /Nombre: no indicado/.test(prompt) && /Curso de interés: no indicado/.test(prompt) && !/undefined|null/.test(prompt), prompt.slice(0, 150).replace(/\n/g, ' | '));
      const asuntoSec = r.json?._prueba?.correoSecretaria?.subject || '';
      ok('el asunto del aviso a secretaría dice «(sin nombre)», no «undefined» ni un hueco', asuntoSec === '[NORMAL] Nueva consulta de (sin nombre)', asuntoSec);
      ok('el mensaje se recorta a 2.000 caracteres antes de ir a la IA', prompt.includes('A'.repeat(1990) + 'FRONTERAB') && !prompt.includes('B'.repeat(12)), `${prompt.length} caracteres en total`);
    });
    await bloque('Recepcionista · orden de los bloques en el archivo que se entrega', async () => {
      const wf = entregable('1', 'terminado');
      ok('primero se avisa a secretaría y después se responde al alumno', sigue(wf, 'Recepcionista IA') === 'Preparar respuesta' && sigue(wf, 'Preparar respuesta') === 'Avisar a secretaría' && sigue(wf, 'Avisar a secretaría') === 'Responder al alumno' && sigue(wf, 'Responder al alumno') === 'Confirmar en la web', [sigue(wf, 'Preparar respuesta'), sigue(wf, 'Avisar a secretaría'), sigue(wf, 'Responder al alumno')].join(' → '));
      const ag = bloque1(wf, 'Recepcionista IA');
      ok('el agente reintenta y, si falla, deja seguir el flujo', ag.retryOnFail === true && ag.maxTries === 3 && ag.onError === 'continueRegularOutput');
      ok('los envíos de correo no se reintentan (no pueden salir dos veces)', ['Avisar a secretaría', 'Responder al alumno'].every((x) => !bloque1(wf, x).retryOnFail));
      ok('los tres flujos llevan un modelo que no caduca', ['1', '2', '3'].every((k) => bloque1(entregable(k, 'terminado'), 'Gemini').parameters.modelName === 'models/gemini-flash-latest'), bloque1(wf, 'Gemini').parameters.modelName);
    });
    await bloque('Recepcionista · texto con etiquetas, comillas, eñes y emojis', async () => {
      const malo = '<script>alert(1)</script> 5 < 7 & "comillas" \'simples\' ñ á ü 😀';
      const r = await conWebhook(n, S1, 'recepcionista', { nombre: '<b>Eva</b> Núñez', email: CORREO, curso: 'Inglés profesional (B2)', mensaje: malo }, 3);
      ok('la web recibe respuesta correcta', r.status === 200 && r.json?.ok === true, `estado ${r.status}`);
      const m = r.json?._prueba?.correoSecretaria?.message || '';
      ok('ninguna etiqueta del visitante llega viva al correo', !/<script/i.test(m) && !/<b>Eva/.test(m));
      ok('el texto se conserva, solo neutralizado', m.includes('&lt;script>alert(1)&lt;/script>') && m.includes('ñ á ü 😀') && m.includes('5 &lt; 7'));
      ok('el nombre vuelve a la web tal cual lo escribió', r.json?.nombre === '<b>Eva</b> Núñez');
    });
    await bloque('Recepcionista · petición sin el campo «curso»', async () => {
      const r = await conWebhook(n, S1, 'recepcionista', { nombre: 'Luis', email: CORREO, mensaje: 'Hola' }, 3);
      ok('no falla aunque falte un campo', r.status === 200 && r.json?.ok === true, `estado ${r.status} ${r.texto.slice(0, 120)}`);
    });
    await bloque('Redactor · tema normal (petición real a Google Noticias)', async () => {
      const r = await conWebhook(n, S2, 'redactor-posts', { tema: 'Inteligencia artificial en la educación', tono: 'Cercano', email: CORREO }, 4);
      ok('la web recibe el post', r.status === 200 && r.json?.ok === true && typeof r.json.post === 'string', `estado ${r.status}`);
      ok('llegan cinco titulares con enlace', (r.json?.fuentes || []).length === 5 && r.json.fuentes.every((f) => /^https?:\/\//.test(f.enlace)), `${(r.json?.fuentes || []).length} titulares`);
      ok('el correo lleva la lista de titulares', /<li><a href="https:\/\//.test(r.json?._prueba?.correo?.message || ''));
    });
    await bloque('Redactor · tema sin noticias', async () => {
      const r = await conWebhook(n, S2, 'redactor-posts', { tema: 'zxqv9k7w3 qwpzj8 inexistente', tono: 'Profesional', email: CORREO }, 4);
      ok('responde igualmente, sin titulares', r.status === 200 && r.json?.ok === true && (r.json.fuentes || []).length === 0, `estado ${r.status}, ${(r.json?.fuentes || []).length} titulares`);
      ok('el correo no lleva un apartado de titulares vacío', !/Titulares en los que se ha apoyado/.test(r.json?._prueba?.correo?.message || 'Titulares en los que se ha apoyado'));
      ok('a la IA se le dice que no hay titulares', /\(no hay titulares recientes sobre este tema\)/.test(r.json?._prueba?.agente?.prompt || ''));
    });
    await bloque('Redactor · Google Noticias no contesta', async () => {
      const t0 = Date.now();
      const r = await conWebhook(n, S2, 'redactor-posts', { tema: 'Inteligencia artificial en la educación', email: CORREO, _sinNoticias: '1' }, 4);
      ok('el flujo no se detiene: el post sale sin titulares', r.status === 200 && r.json?.ok === true && typeof r.json.post === 'string' && (r.json.fuentes || []).length === 0, `estado ${r.status} ${r.texto.slice(0, 140)}`);
      ok('responde en pocos segundos, sin quedarse colgado', Date.now() - t0 < 25000, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
      ok('sin tono elegido, se usa uno por defecto', /Tono: cercano y profesional/.test(r.json?._prueba?.agente?.prompt || ''), (r.json?._prueba?.agente?.prompt || '').split('\n')[1]);
      await sleep(1200);
      const e = await ultimaEjecucion(S2);
      ok('la petición falló de verdad y quedó anotado en su bloque', !!e?.salida?.['Buscar noticias']?.items?.[0]?.error, JSON.stringify(e?.salida?.['Buscar noticias']?.items?.[0] || null).slice(0, 120));
    });
    await bloque('Redactor · sin internet (el nombre del servidor de noticias no se resuelve)', async () => {
      const t0 = Date.now();
      const r = await conWebhook(n, S2, 'redactor-posts', { tema: 'Teletrabajo', tono: 'Profesional', email: CORREO, _sinNoticias: 'dns' }, 4);
      ok('el post sale igualmente, sin titulares', r.status === 200 && r.json?.ok === true && typeof r.json.post === 'string' && (r.json.fuentes || []).length === 0, `estado ${r.status} ${r.texto.slice(0, 140)}`);
      ok('y no tarda más de lo que permiten los dos intentos', Date.now() - t0 < 25000, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
    });
    await bloque('Redactor · ajustes del archivo que se entrega', async () => {
      const wf = entregable('2', 'terminado');
      const h = bloque1(wf, 'Buscar noticias');
      ok('las noticias se limitan a la última semana', /when:7d$/.test(h.parameters.queryParameters.parameters.find((x) => x.name === 'q').value), h.parameters.queryParameters.parameters.find((x) => x.name === 'q').value);
      ok('la petición tiene límite de tiempo, reintento y no detiene el flujo', h.parameters.options.timeout === 6000 && h.retryOnFail === true && h.maxTries === 2 && h.onError === 'continueRegularOutput' && bloque1(wf, 'Leer XML').onError === 'continueRegularOutput' && bloque1(wf, 'Leer XML').alwaysOutputData === true);
    });
    await bloque('Resumen de Gmail · cabeceras en minúsculas, correo sin asunto y cuenta vacía', async () => {
      const r = await conWebhook(n, S3, 'prueba-3-resumen-varios-gmail', {}, 5, 'GET');
      ok('el flujo termina', r.status === 200, `estado ${r.status} ${r.texto.slice(0, 120)}`);
      await sleep(1500);
      const e = await ultimaEjecucion(S3);
      const lista = e?.salida?.['Preparar la lista']?.items?.[0] || {};
      const correos = lista.correos || [];
      const asuntos = correos.map((c) => `${c.cuenta}: ${c.asunto}`);
      const enviado = e?.salida?.['Enviar resumen']?.items?.[0] || {};
      ok('lee el asunto aunque la cabecera venga en minúsculas', asuntos.includes('Personal: Tu recibo de la luz está disponible'), asuntos.join(' | '));
      ok('distingue un correo sin asunto', asuntos.includes('Personal: (sin asunto)'));
      ok('la cuenta sin correos sigue en la lista, sin correos', (lista.cuentas || []).includes('Trabajo') && !correos.some((c) => c.cuenta === 'Trabajo'), JSON.stringify(lista.cuentas));
      ok('las cuentas 3 y 4, apagadas, no aparecen', JSON.stringify(lista.cuentas) === '["Personal","Trabajo"]', JSON.stringify(lista.cuentas));
      ok('cada correo lleva su enlace a Gmail', correos.length > 0 && correos.every((c) => c.enlace.endsWith('#all/' + c.id)), correos[0]?.enlace);
      ok('lee el remitente aunque venga en minúsculas', correos.some((c) => c.de === 'Banco Ejemplo <avisos@banco.example>'));
      ok('asunto del resumen con la fecha en español', /^Resumen de tus correos · (lunes|martes|miércoles|jueves|viernes|sábado|domingo) \d+ de [a-z]+$/.test(enviado.subject || ''), enviado.subject);
    });
    await bloque('Resumen de Gmail · ajustes de los archivos que se entregan', async () => {
      for (const variante of ['terminado', 'para-montar', 'ensayo']) {
        const wf = entregable('3', variante);
        const q = ['Leer cuenta 1', 'Leer cuenta 2'].map((x) => bloque1(wf, x).parameters.filters.q);
        ok(`${variante}: no lee lo que ha enviado la propia cuenta (ni su resumen de ayer)`, q.every((x) => /(^| )-from:me( |$)/.test(x) && /newer_than:1d/.test(x)), q[0]);
        ok(`${variante}: el archivo lleva la zona horaria de Madrid (vale para quien importe por línea de órdenes)`, wf.settings?.timezone === 'Europe/Madrid' && wf.settings?.executionOrder === 'v1', JSON.stringify(wf.settings));
      }
      const wf = entregable('3', 'terminado');
      ok('leer correos se reintenta; enviar el resumen, no', ['Leer cuenta 1', 'Leer cuenta 2'].every((x) => bloque1(wf, x).retryOnFail === true && bloque1(wf, x).alwaysOutputData === true) && !bloque1(wf, 'Enviar resumen').retryOnFail);
      ok('el agente insiste más que en los flujos con web', bloque1(wf, 'Analista IA').maxTries === 5 && bloque1(wf, 'Analista IA').waitBetweenTries === 5000);
    });
  }

  // ───────── 2. Flujos reales con el agente ejecutándose contra una IA simulada local ─────────
  if (QUE.has('ia')) {
    const M1 = idDe('Recepcionista IA (prueba con IA simulada'); const M2 = idDe('Redactor de posts (prueba con IA simulada'); const M3 = idDe('Resumen de varios Gmail (prueba con IA simulada');
    const antes = registroIA().length;
    await bloque('Recepcionista con agente real · los tres ejemplos de la web', async () => {
      await abrir(n, M1);
      const esperado = [['Precios', 'Normal'], ['Matrícula', 'Normal'], ['Incidencia', 'Alta']];
      for (let i = 0; i < 3; i++) {
        // antes de volver a pulsar «Execute workflow» se espera a que el editor haya terminado la ejecución anterior
        await n.frente(); await n.esperar(`!document.title.startsWith('🔄')`, 30000, 'que termine la ejecución anterior').catch(() => {}); await sleep(1200);
        await ejecutar(n); await aLaEscucha(n); await sleep(700);
        const p = await enviarContacto(web, i);
        ok(`ejemplo ${i + 1}: la página muestra ${esperado[i][0]} / ${esperado[i][1]}`, p.exito && p.categoria === esperado[i][0] && p.urgencia === esperado[i][1], p.exito ? `${p.categoria} / ${p.urgencia} · «${p.asunto}»` : p.aviso);
        ok(`ejemplo ${i + 1}: la página enseña el correo de respuesta`, p.correoVisible && /^Hola, /.test(p.respuesta) && /Lucía · Academia Lumen$/.test(p.respuesta), p.respuesta.slice(0, 90).replace(/\n/g, ' '));
        await n.frente();
        await n.esperar(exito('Confirmar en la web'), 30000, 'el final de la ejecución');
        if (i === 2) { await web.frente(); await web.foto('ia-1-pagina-queja-urgente.png', { completa: true }); await n.frente(); await sleep(800); await encajar(n); await n.foto('ia-1-lienzo.png'); }
      }
      const est = await n.js(estadoNodos);
      ok('el agente, Gemini y el formato de salida se ejecutan de verdad', /Recepcionista IA=[^·]*success/.test(est) && /Gemini=success/.test(est) && /Formato de salida=success/.test(est), est);
    });
    await bloque('Recepcionista con agente real · la IA falla una vez (error del servidor)', async () => {
      const r = await conWebhook(n, M1, 'recepcionista', { nombre: 'Prueba Reintento', email: CORREO, curso: 'Ofimática básica', mensaje: `¿Cuánto cuesta? [prueba:error-500] ${Date.now()}` });
      ok('el reintento automático lo resuelve y la web recibe respuesta', r.status === 200 && r.json?.ok === true, `estado ${r.status} ${r.texto.slice(0, 160)}`);
    });
    await bloque('Recepcionista con agente real · la IA contesta una vez sin el formato pedido', async () => {
      const r = await conWebhook(n, M1, 'recepcionista', { nombre: 'Prueba Formato', email: CORREO, curso: 'Ofimática básica', mensaje: `¿Qué horario tiene? [prueba:json-roto] ${Date.now()}` });
      ok('el reintento automático lo resuelve y la web recibe respuesta', r.status === 200 && r.json?.ok === true && r.json.categoria === 'horarios', `estado ${r.status} ${r.texto.slice(0, 160)}`);
    });
    await bloque('Recepcionista con agente real · la IA falla en todos los intentos: respuesta de reserva', async () => {
      await abrir(n, M1);
      await n.frente(); await ejecutar(n); await aLaEscucha(n); await sleep(700);
      const t0 = Date.now();
      const p = await enviarContacto(web, 0, `[prueba:error-siempre] ${Date.now()}`);
      const seg = (Date.now() - t0) / 1000;
      ok('la página no da error: avisa de que es una respuesta automática', p.exito && p.reserva && !p.clasificacionVisible, p.exito ? `aviso de reserva=${p.reserva}, clasificación visible=${p.clasificacionVisible}` : p.aviso);
      ok('y enseña el correo de reserva con el nombre de la persona', p.correoVisible && /^Hola, Ana García:/.test(p.respuesta) && /Hemos recibido tu consulta/.test(p.respuesta), p.respuesta.slice(0, 80).replace(/\n/g, ' '));
      ok('tarda segundos, no minutos', seg < 30, `${seg.toFixed(1)} s desde que se abre la página`);
      await web.foto('ia-1-pagina-reserva.png', { completa: true });
      await n.frente(); await n.esperar(exito('Confirmar en la web'), 30000, 'el final de la ejecución'); await sleep(800); await encajar(n); await n.foto('ia-1-lienzo-reserva.png');
      await sleep(1000);
      const e = await ultimaEjecucion(M1);
      ok('la ejecución termina bien aunque la IA haya fallado', e?.status === 'success', `${e?.status} ${e?.error || ''}`);
      ok('el fallo queda anotado en el bloque del agente', !!e?.salida?.['Recepcionista IA']?.items?.[0]?.error, JSON.stringify(e?.salida?.['Recepcionista IA']?.items?.[0] || null).slice(0, 120));
      const prep = e?.salida?.['Preparar respuesta']?.items?.[0] || {};
      ok('«Preparar respuesta» entrega la de reserva y la marca como urgente', prep.respondio_la_ia === false && prep.urgencia === 'alta' && /hay que contestar a mano/.test(prep.resumen_interno || ''), (prep.resumen_interno || '').slice(0, 110));
    });
    await bloque('Recepcionista con agente real · después del fallo, la siguiente consulta vuelve a ser de la IA', async () => {
      const r = await conWebhook(n, M1, 'recepcionista', { nombre: 'Prueba Normal', email: CORREO, curso: 'Ofimática básica', mensaje: '¿Qué horario tiene el curso?' });
      ok('responde la IA y lo dice', r.status === 200 && r.json?.ok === true && r.json.respondio_la_ia === true && r.json.categoria === 'horarios', `estado ${r.status}, respondio_la_ia=${r.json?.respondio_la_ia}, ${r.json?.categoria}`);
    });
    await bloque('Redactor con agente real · desde la mini-web', async () => {
      await abrir(n, M2);
      await n.frente(); await ejecutar(n); await aLaEscucha(n); await sleep(700);
      const p = await enviarRedactor(web, 'Automatización en pequeñas empresas');
      ok('la mini-web muestra el post', p.exito && p.post.length > 300, p.exito ? p.post.slice(0, 80).replace(/\n/g, ' ') : p.aviso);
      ok('el post se apoya en un titular real', /«.+»/.test(p.post) && p.fuentes >= 1, `${p.fuentes} titulares`);
      await web.foto('ia-2-pagina-post.png', { completa: true });
      await n.frente(); await n.esperar(exito('Mostrar en la web'), 30000, 'el final de la ejecución'); await sleep(800); await encajar(n); await n.foto('ia-2-lienzo.png');
      const est = await n.js(estadoNodos);
      ok('el agente y Gemini se ejecutan de verdad', /Redactor IA=[^·]*success/.test(est) && /Gemini=success/.test(est), est);
    });
    await bloque('Resumen de Gmail con agente real', async () => {
      await abrir(n, M3);
      await n.frente(); await ejecutar(n);
      await n.esperar(exito('Analista IA'), 60000, 'que el agente termine');
      await n.esperar(`!document.title.startsWith('🔄')`, 30000).catch(() => {});
      await sleep(1500); await encajar(n); await n.foto('ia-3-lienzo.png');
      const e = await ultimaEjecucion(M3);
      const html = e?.salida?.['Montar el resumen']?.items?.[0]?.html || '';
      ok('la ejecución termina bien', e?.status === 'success', `${e?.status} ${e?.error || ''}`);
      ok('el resumen trae una sección por cuenta', /<h3[^>]*>Personal<\/h3>/.test(html) && /<h3[^>]*>Trabajo<\/h3>/.test(html), html.replace(/\s+/g, ' ').slice(0, 140));
      ok('cada correo lleva «Abrir en Gmail»', /Abrir en Gmail/.test(html));
      ok('separa lo urgente', /<strong>Urgente<\/strong>/.test(html));
    });
    await bloque('Lo que n8n le envía de verdad a la IA', async () => {
      const reg = registroIA().slice(antes);
      const f1 = reg.filter((x) => x.flujo === 1); const f2 = reg.filter((x) => x.flujo === 2); const f3 = reg.filter((x) => x.flujo === 3);
      ok('las peticiones llegan a la IA simulada y todas se reconocen', reg.length >= 7 && reg.every((x) => x.flujo && x.flujo !== 'desconocido' && x.estado !== 404), `${reg.length} peticiones: ${f1.length} recepcionista, ${f2.length} redactor, ${f3.length} resumen`);
      ok('recepcionista: llegan las instrucciones y la herramienta de formato', f1.length > 0 && f1.every((x) => x.sistema > 1500 && x.herramientas.includes('format_final_json_response')), JSON.stringify(f1[0] || {}).slice(0, 200));
      ok('recepcionista: el formato de salida se entrega por la vía prevista', f1.some((x) => x.via === 'herramienta de salida'), [...new Set(f1.map((x) => `${x.via}${x.envuelto === undefined ? '' : x.envuelto ? ' (envuelto en output)' : ' (sin envolver)'}`))].join(', '));
      const prov = (t) => f1.filter((x) => x.provocado === t).length;
      ok('los fallos provocados se reintentaron', prov('error 500') === 1 && prov('salida sin formato') === 1 && f1.filter((x) => /Prueba (Reintento|Formato)/.test(x.usuario)).length >= 4, `${prov('error 500')} error del servidor, ${prov('salida sin formato')} sin formato`);
      ok('cuando la IA falla siempre, se intenta tres veces y no más', prov('error en todos los intentos') === 3, `${prov('error en todos los intentos')} intentos`);
      ok('todas las peticiones piden el modelo que no caduca', reg.every((x) => x.modelo === 'gemini-flash-latest'), [...new Set(reg.map((x) => x.modelo))].join(', '));
      ok('redactor y resumen: llegan el tema y la lista de correos', f2.some((x) => /Tema del post: Automatización/.test(x.usuario)) && f3.some((x) => /formato JSON/.test(x.usuario)));
    });
  }

  // ───────── 3. Copias de ensayo sin conexión (las que se entregan como plan B) ─────────
  if (QUE.has('ensayo')) {
    const E1 = idDe('Recepcionista IA (ensayo'); const E2 = idDe('Redactor de posts (ensayo'); const E3 = idDe('Resumen de varios Gmail (ensayo');
    await bloque('Ensayo sin conexión · recepcionista', async () => {
      await abrir(n, E1);
      await n.frente(); await ejecutar(n); await aLaEscucha(n); await sleep(700);
      const p = await enviarContacto(web, 0);
      ok('la página muestra la clasificación y el correo de ejemplo', p.exito && p.categoria === 'Precios' && p.correoVisible && /171 €/.test(p.respuesta), p.exito ? p.asunto : p.aviso);
      await web.foto('ensayo-1-pagina.png', { completa: true });
      await n.frente(); await n.esperar(exito('Confirmar en la web'), 30000); await sleep(800); await encajar(n); await n.foto('ensayo-1-lienzo.png');
    });
    await bloque('Ensayo sin conexión · redactor', async () => {
      await abrir(n, E2);
      await n.frente(); await ejecutar(n); await aLaEscucha(n); await sleep(700);
      const p = await enviarRedactor(web, 'Inteligencia artificial en la educación');
      ok('la mini-web muestra el post de ejemplo y titulares reales', p.exito && /compañera de estudio/.test(p.post) && p.fuentes >= 1, p.exito ? `${p.fuentes} titulares` : p.aviso);
      await n.frente(); await n.esperar(exito('Mostrar en la web'), 30000);
    });
    await bloque('Ensayo sin conexión · resumen de Gmail', async () => {
      await abrir(n, E3);
      await n.frente(); await ejecutar(n);
      await n.esperar(exito('Hacer una lista'), 40000);
      await n.esperar(`!document.title.startsWith('🔄')`, 30000).catch(() => {});
      await sleep(1200);
      const e = await ultimaEjecucion(E3);
      ok('la ejecución termina bien', e?.status === 'success', `${e?.status} ${e?.error || ''}`);
      ok('une los seis correos de las dos cuentas', (e?.salida?.['Hacer una lista']?.items?.[0]?.correos || []).length === 6);
    });
  }

  // ───────── 4. Montaje en directo: unir los bloques arrastrando, en el orden del guion ─────────
  if (QUE.has('montaje')) {
    const guion = JSON.parse(fs.readFileSync(path.join(SP, 'pruebas', 'guion.json'), 'utf8'));
    const terminados = Object.fromEntries(['1', '2', '3'].map((k) => { const f = fs.readdirSync(path.join(PROY, 'flujos')).find((x) => x.startsWith(k + '-') && x.endsWith('-terminado.json')); return [k, JSON.parse(fs.readFileSync(path.join(PROY, 'flujos', f), 'utf8'))]; }));
    const plano = (c) => Object.entries(c || {}).flatMap(([de, tipos]) => Object.entries(tipos).flatMap(([tipo, salidas]) => salidas.flatMap((dest, i) => (dest || []).map((d) => `${de} -[${tipo} ${i}→${d.index}]-> ${d.node}`)))).sort();
    for (const g of guion.filter((x) => !process.env.SOLO || process.env.SOLO.includes(x.key[0]))) {
      const k = g.key[0];
      await bloque(`Montaje en directo · ${g.name}`, async () => {
        const id = idDe(`${g.name} (montaje de prueba`);
        await abrir(n, id);
        ok('empieza sin ninguna unión', (await n.js(`document.querySelectorAll('.vue-flow__edge').length`)) === 0);
        const destino = terminados[k].connections;
        const p0 = g.pasos[0];
        const editable = `(() => { const h = document.querySelector('[data-test-id="canvas-node"][data-node-name="${p0.from}"] [data-test-id="canvas-node-output-handle"]'); if (!h) return false; const b = h.getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return !!(e && e.closest('.vue-flow__handle')); })()`;
        for (let i = 0; i < 4 && !(await n.js(editable)); i++) { await tomarEdicion(n); await sleep(1500); }
        ok('el lienzo se puede editar', await n.js(editable));
        for (const p of g.pasos) {
          const tipo = p.type || 'main';
          const idx = (destino[p.from]?.[tipo]?.[0] || []).find((d) => d.node === p.to)?.index ?? 0;
          const a = await n.centro(`document.querySelector('[data-test-id="canvas-node"][data-node-name="${p.from}"] [data-test-id="canvas-node-output-handle"][data-connection-type="${tipo}"]')`);
          const b = await n.centro(`document.querySelector('[data-test-id="canvas-node"][data-node-name="${p.to}"] [data-test-id="canvas-node-input-handle"][data-connection-type="${tipo}"][data-index="${idx}"]')`);
          await n.arrastrar(a, b);
        }
        await sleep(600);
        await n.foto(`montaje-${k}-unido.png`);
        const hecho = await n.js(`(() => { const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia; return JSON.parse(JSON.stringify(p._s.get('workflowDocuments/${id}@latest').connectionsBySourceNode || {})); })()`);
        const A = plano(hecho); const B = plano(destino);
        ok(`las ${g.pasos.length} uniones del guion quedan hechas arrastrando`, A.length === B.length, `${A.length} de ${B.length}`);
        ok('el resultado es idéntico al flujo terminado', JSON.stringify(A) === JSON.stringify(B), A.filter((x) => !B.includes(x)).concat(B.filter((x) => !A.includes(x)).map((x) => 'falta: ' + x)).join(' | '));
        // y funciona: se ejecuta recién montado
        if (k === '1') {
          await ejecutar(n); await aLaEscucha(n); await sleep(700);
          const p = await enviarContacto(web, 1);
          ok('recién montado, funciona: la web recibe la respuesta', p.exito && p.categoria === 'Matrícula', p.exito ? p.asunto : p.aviso);
          await n.frente(); await n.esperar(exito('Confirmar en la web'), 30000); await sleep(700); await encajar(n); await n.foto('montaje-1-ejecutado.png');
        } else if (k === '2') {
          await ejecutar(n); await aLaEscucha(n); await sleep(700);
          const p = await enviarRedactor(web, 'Teletrabajo y productividad');
          ok('recién montado, funciona: la mini-web recibe el post', p.exito && p.post.length > 300, p.exito ? `${p.fuentes} titulares` : p.aviso);
          await n.frente(); await n.esperar(exito('Mostrar en la web'), 30000);
        } else {
          await ejecutar(n);
          await n.esperar(exito('Analista IA'), 60000, 'que el agente termine');
          ok('recién montado, funciona: el agente genera el resumen', true);
        }
      });
    }
  }

  // ───────── 5. Importar un archivo desde el menú del editor, como hará ella ─────────
  if (QUE.has('importar')) {
    // Abre un flujo nuevo, pulsa de verdad «Import → From file» y responde al selector de archivos, como hará ella.
    const importarDesdeMenu = async (archivo, bloques, uniones) => {
      await n.frente();
      await n.ir(`${N8N}/workflow/new`);
      await n.esperar(`!!document.querySelector('[data-test-id="workflow-menu"]')`, 60000, 'el editor vacío');
      await sleep(1500);
      await n.clic(`document.querySelector('[data-test-id="workflow-menu"]')`);
      await sleep(600);
      await n.clic(`document.querySelector('[data-test-id="workflow-menu-item-import"]')`).catch(() => {});
      await sleep(700);
      const opciones = await n.js(`[...document.querySelectorAll('[role="menuitem"], .el-dropdown-menu__item, [data-test-id*="menu-item-import"]')].filter((e) => e.offsetWidth).map((e) => e.textContent.trim().replace(/\\s+/g, ' ')).filter((t) => /import|file|url|archivo/i.test(t))`);
      await n.s('Page.setInterceptFileChooserDialog', { enabled: true });
      const selector = evento('Page.fileChooserOpened', 20000);
      await n.clic(`[...document.querySelectorAll('[role="menuitem"], .el-dropdown-menu__item, li')].filter((e) => e.offsetWidth && e.textContent.trim() === 'From file')[0]`);
      const abierto = await selector;
      await n.s('DOM.setFileInputFiles', { files: [archivo], backendNodeId: abierto.backendNodeId });
      try { await n.esperar(`${NODOS}.length >= ${bloques} && document.querySelectorAll('.vue-flow__edge').length >= ${uniones}`, 40000, 'que aparezcan los bloques importados'); } catch (e) {
        await n.foto('importar-fallo.png');
        const pantalla = await n.js(`({ url: location.pathname, nodos: ${NODOS}.length, dialogos: [...document.querySelectorAll('[role=dialog], .el-message-box')].filter((d) => d.offsetWidth).map((d) => d.textContent.trim().replace(/\\s+/g, ' ').slice(0, 200)), avisos: ${avisos}, archivos: (document.querySelector('[data-test-id="workflow-import-input"]') || {}).files ? document.querySelector('[data-test-id="workflow-import-input"]').files.length : -1 })`);
        throw new Error('no aparecen los bloques · ' + JSON.stringify(pantalla));
      }
      await sleep(1200);
      return { opciones, nombres: await n.js(`[...${NODOS}].map((x) => x.getAttribute('data-node-name')).filter((x) => x && !x.startsWith('Nota'))`) };
    };
    await bloque('Importar desde el menú del editor', async () => {
      const { opciones, nombres } = await importarDesdeMenu(path.join(PROY, 'flujos', '1-recepcionista-ia-terminado.json'), 8, 7);
      ok('el menú tiene la opción de importar desde archivo', opciones.some((t) => /from file/i.test(t)), opciones.join(' | '));
      ok('aparecen los ocho bloques del flujo', nombres.length === 8, nombres.join(', '));
      ok('aparecen unidos', (await n.js(`document.querySelectorAll('.vue-flow__edge').length`)) === 7);
      const av = await n.js(avisos);
      ok('sin avisos de error al importar', !av.some((t) => /error|problem|could not|unknown/i.test(t)), av.join(' | '));
      await encajar(n); await n.foto('importar-desde-archivo.png');
      await sleep(3500); // n8n guarda solo: se espera a que lo haga para leer lo guardado
      const id = await n.js(`location.pathname.split('/').pop()`);
      const fila = bd((db) => db.prepare('SELECT name, nodes FROM workflow_entity WHERE id = ?').get(id));
      ok('el flujo importado se guarda con su nombre', /Recepcionista IA \(terminado\)/.test(fila?.name || ''), fila?.name || `sin guardar (${id})`);
      const guardados = fila ? JSON.parse(fila.nodes) : [];
      const ag = guardados.find((x) => x.name === 'Recepcionista IA') || {};
      ok('al importar se conservan los reintentos y el «seguir si falla» del agente', ag.retryOnFail === true && ag.maxTries === 3 && ag.onError === 'continueRegularOutput', JSON.stringify({ retryOnFail: ag.retryOnFail, maxTries: ag.maxTries, onError: ag.onError }));
    });
    await bloque('Importar el flujo 3 desde el menú · ¿se conserva la zona horaria?', async () => {
      const { nombres } = await importarDesdeMenu(path.join(PROY, 'flujos', '3-resumen-varios-gmail-terminado.json'), 10, 10);
      ok('aparecen los diez bloques', nombres.length === 10, nombres.join(', '));
      await sleep(3500);
      const id = await n.js(`location.pathname.split('/').pop()`);
      const fila = bd((db) => db.prepare('SELECT name, settings FROM workflow_entity WHERE id = ?').get(id));
      const ajustes = () => JSON.parse(bd((db) => db.prepare('SELECT settings FROM workflow_entity WHERE id = ?').get(id))?.settings || '{}');
      const aj = ajustes();
      // Dato comprobado, no un requisito: n8n 2.42.6 no guarda la zona horaria del archivo al importar desde el menú.
      // Por eso la nota del flujo y la guía piden ponerla a mano, y aquí se comprueba que ese paso funciona.
      console.log(`    (dato) ajustes que n8n guarda al importar desde el menú: ${JSON.stringify(aj)}`);
      ok('el flujo importado se guarda', !!fila, id);
      await n.clic(`document.querySelector('[data-test-id="workflow-menu"]')`);
      await sleep(700);
      const item = `[...document.querySelectorAll('[data-test-id="workflow-menu-item-settings"], [role="menuitem"], .el-dropdown-menu__item')].filter((e) => e.offsetWidth && /^Settings$/i.test(e.textContent.trim()))[0]`;
      ok('el menú de los tres puntos tiene la opción «Settings»', await n.js(`!!(${item})`));
      await n.clic(item);
      await sleep(1800);
      const campo = `document.querySelector('[data-test-id="workflow-settings-timezone"]')`;
      ok('en los ajustes del flujo hay un campo «Timezone»', await n.js(`!!(${campo}) && /Timezone/.test(document.querySelector('[data-test-id="workflow-settings-dialog"]').textContent)`));
      // el paso que pide la guía: elegir la zona y guardar (con una distinta de la del n8n de pruebas, para que se note)
      await n.clic(`${campo}.querySelector('input') || ${campo}`);
      await sleep(600);
      await n.escribir('Canary');
      await sleep(900);
      await n.clic(`[...document.querySelectorAll('.el-select-dropdown__item')].filter((e) => e.offsetWidth && e.textContent.trim().includes('Atlantic/Canary'))[0]`);
      await sleep(500);
      await n.foto('ajustes-zona-horaria.png');
      await n.clic(`[...document.querySelectorAll('[role=dialog] button, .el-dialog button')].filter((b) => b.offsetWidth && b.textContent.trim() === 'Save')[0]`);
      // se espera a que n8n lo guarde (justo después de importar puede tardar unos segundos) y se anota cuánto tarda
      const t0 = Date.now();
      while (ajustes().timezone !== 'Atlantic/Canary' && Date.now() - t0 < 20000) await sleep(500);
      const cerrado = await n.js(`![...document.querySelectorAll('[data-test-id="workflow-settings-dialog"]')].some((d) => d.offsetWidth)`);
      ok('elegir la zona horaria a mano y pulsar «Save» la deja guardada', ajustes().timezone === 'Atlantic/Canary', `${JSON.stringify(ajustes())} · ${((Date.now() - t0) / 1000).toFixed(1)} s · diálogo cerrado=${cerrado} · avisos: ${(await n.js(avisos)).join(' | ').slice(0, 160)}`);
    });
  }
} catch (e) {
  res.push({ grupo: 'general', nombre: 'la batería arranca', ok: false, detalle: e.message });
  console.log('✗', e.message);
} finally {
  await cerrarNavegador();
  const mal = res.filter((r) => !r.ok);
  console.log(`\nRESULTADO: ${res.length - mal.length} comprobaciones bien, ${mal.length} con problemas`);
  for (const m of mal) console.log(`  ✗ [${m.grupo}] ${m.nombre}${m.detalle ? ' — ' + String(m.detalle).slice(0, 300) : ''}`);
  fs.writeFileSync(path.join(SP, 'pruebas', 'resultado-bateria.json'), JSON.stringify(res, null, 1));
  process.exit(mal.length ? 1 : 0);
}
