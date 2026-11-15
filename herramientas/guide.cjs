// Genera guia.html (con un diagrama por flujo) a partir de flows.cjs.
// Uso: node guide.cjs <carpeta-proyecto>
const fs = require('fs');
const path = require('path');
const { flows, MI_CORREO } = require('./flows.cjs');
const { layout, pasos, sizeOf, byKey } = require('./build.cjs');

const OUT = process.argv[2];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/`(.+?)`/g, '<code>$1</code>');

// ───────────── diagrama SVG ─────────────
const CLASE = { webhook: 'k-inicio', schedule: 'k-inicio', agent: 'k-ia', gemini: 'k-ia', parser: 'k-ia', gmail: 'k-gmail', http: 'k-http', xml: 'k-datos', set: 'k-datos', merge: 'k-datos', aggregate: 'k-datos', respond: 'k-fin' };
const MARCO = { 4: 'm-verde', 5: 'm-azul', 6: 'm-morado', 7: 'm-gris' };

function icono(t, cx, cy) {
  const S = 'fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"';
  switch (t) {
    case 'webhook':
      return `<g ${S}><path d="M${cx - 16} ${cy + 12} L${cx} ${cy - 16} L${cx + 16} ${cy + 12} Z"/><circle cx="${cx - 16}" cy="${cy + 12}" r="5" fill="var(--nodo)"/><circle cx="${cx}" cy="${cy - 16}" r="5" fill="var(--nodo)"/><circle cx="${cx + 16}" cy="${cy + 12}" r="5" fill="var(--nodo)"/></g>`;
    case 'agent':
      return `<g ${S}><rect x="${cx - 20}" y="${cy - 10}" width="40" height="28" rx="7"/><path d="M${cx} ${cy - 10} V${cy - 19}"/><circle cx="${cx}" cy="${cy - 22}" r="2.5"/><circle cx="${cx - 8}" cy="${cy + 3}" r="2.2" fill="currentColor"/><circle cx="${cx + 8}" cy="${cy + 3}" r="2.2" fill="currentColor"/></g>`;
    case 'gemini':
      return `<path d="M${cx} ${cy - 19} Q${cx + 3} ${cy - 3} ${cx + 19} ${cy} Q${cx + 3} ${cy + 3} ${cx} ${cy + 19} Q${cx - 3} ${cy + 3} ${cx - 19} ${cy} Q${cx - 3} ${cy - 3} ${cx} ${cy - 19} Z" fill="currentColor"/>`;
    case 'parser':
      return `<text x="${cx}" y="${cy + 10}" text-anchor="middle" font-size="30" font-weight="600" fill="currentColor">{ }</text>`;
    case 'gmail':
      return `<g ${S}><rect x="${cx - 20}" y="${cy - 14}" width="40" height="28" rx="4"/><path d="M${cx - 20} ${cy - 11} L${cx} ${cy + 4} L${cx + 20} ${cy - 11}"/></g>`;
    case 'http':
      return `<g ${S}><circle cx="${cx}" cy="${cy}" r="19"/><ellipse cx="${cx}" cy="${cy}" rx="8" ry="19"/><path d="M${cx - 19} ${cy} H${cx + 19}"/></g>`;
    case 'xml':
      return `<text x="${cx}" y="${cy + 9}" text-anchor="middle" font-size="26" font-weight="600" fill="currentColor">&lt;/&gt;</text>`;
    case 'set':
      return `<g ${S}><path d="M${cx - 18} ${cy - 10} H${cx + 18} M${cx - 18} ${cy + 10} H${cx + 18}"/><circle cx="${cx - 6}" cy="${cy - 10}" r="5" fill="var(--nodo)"/><circle cx="${cx + 8}" cy="${cy + 10}" r="5" fill="var(--nodo)"/></g>`;
    case 'merge':
      return `<g ${S}><path d="M${cx - 18} ${cy - 14} C${cx - 2} ${cy - 14} ${cx - 6} ${cy} ${cx + 6} ${cy} M${cx - 18} ${cy + 14} C${cx - 2} ${cy + 14} ${cx - 6} ${cy} ${cx + 6} ${cy} H${cx + 18}"/></g>`;
    case 'aggregate':
      return `<g ${S}><path d="M${cx - 9} ${cy - 12} H${cx + 18} M${cx - 9} ${cy} H${cx + 18} M${cx - 9} ${cy + 12} H${cx + 18}"/><circle cx="${cx - 17}" cy="${cy - 12}" r="1.8" fill="currentColor"/><circle cx="${cx - 17}" cy="${cy}" r="1.8" fill="currentColor"/><circle cx="${cx - 17}" cy="${cy + 12}" r="1.8" fill="currentColor"/></g>`;
    case 'schedule':
      return `<g ${S}><circle cx="${cx}" cy="${cy}" r="19"/><path d="M${cx} ${cy - 10} V${cy} L${cx + 8} ${cy + 5}"/></g>`;
    case 'respond':
      return `<g ${S}><path d="M${cx + 18} ${cy + 14} V${cy + 4} a10 10 0 0 0 -10 -10 H${cx - 14} M${cx - 5} ${cy - 16} L${cx - 15} ${cy - 6} L${cx - 5} ${cy + 4}"/></g>`;
    default:
      return '';
  }
}

function partir(texto, max) {
  const out = [];
  let linea = '';
  for (const palabra of texto.split(' ')) {
    if (linea && (linea + ' ' + palabra).length > max) { out.push(linea); linea = palabra; }
    else linea = linea ? linea + ' ' + palabra : palabra;
  }
  if (linea) out.push(linea);
  return out;
}

function diagrama(flow) {
  const lay = layout(flow);
  const k = byKey(flow);
  const M = 20;
  const vb = [lay.left - M, lay.top - M, lay.right - lay.left + 2 * M, lay.bottom - lay.top + 2 * M];
  const p = [];
  p.push(`<svg viewBox="${vb.join(' ')}" role="img" aria-label="Diagrama del flujo ${esc(flow.name)} con el orden de las uniones">`);
  for (const f of lay.frames) {
    p.push(`<rect class="marco ${MARCO[f.color]}" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="20"/>`);
    p.push(`<text class="marco-t" x="${f.x + 26}" y="${f.y + 56}">${esc(f.titulo)}</text>`);
  }
  // cuántas entradas principales recibe cada nodo (para repartirlas en vertical)
  const entradas = {};
  for (const l of flow.links) if (!l.type) entradas[l.to] = Math.max(entradas[l.to] || 1, (l.toIndex || 0) + 1);
  const chapas = [];
  pasos(flow).forEach((ps, i) => {
    const l = flow.links[i];
    const a = k[l.from];
    const b = k[l.to];
    const [aw, ah] = sizeOf(a);
    const [bw, bh] = sizeOf(b);
    if (l.type) {
      const x = a.pos[0] + aw / 2;
      const y1 = a.pos[1];
      const y2 = b.pos[1] + bh;
      p.push(`<path class="linea ia" d="M${x} ${y1} V${y2}"/>`);
      chapas.push({ x, y: (y1 + y2) / 2, n: ps.n, ia: true });
    } else {
      const sx = a.pos[0] + aw;
      const sy = a.pos[1] + ah / 2;
      const tx = b.pos[0];
      const n = entradas[l.to] || 1;
      const ty = b.pos[1] + (bh * ((l.toIndex || 0) + 1)) / (n + 1);
      const dx = Math.max(40, (tx - sx) / 2);
      p.push(`<path class="linea" d="M${sx} ${sy} C${sx + dx} ${sy} ${tx - dx} ${ty} ${tx} ${ty}"/>`);
      chapas.push({ x: (sx + tx) / 2, y: (sy + ty) / 2, n: ps.n, ia: false });
    }
  });
  for (const n of flow.nodes) {
    const [w, h] = sizeOf(n);
    const [x, y] = n.pos;
    const cx = x + w / 2;
    const cy = y + h / 2;
    p.push(`<g class="${CLASE[n.t]}">`);
    p.push(n.sub ? `<circle class="nodo" cx="${cx}" cy="${cy}" r="${w / 2}"/>` : `<rect class="nodo" x="${x}" y="${y}" width="${w}" height="${h}" rx="20"/>`);
    p.push(icono(n.t, cx, cy));
    p.push('</g>');
    if (n.t === 'agent') {
      // el nombre del agente va encima: por debajo salen las uniones con el modelo
      p.push(`<text class="nombre" x="${cx}" y="${y - 18}" text-anchor="middle">${esc(n.name)}</text>`);
    } else {
      partir(n.name, 13).forEach((linea, i) => {
        p.push(`<text class="nombre" x="${cx}" y="${y + h + 34 + i * 30}" text-anchor="middle">${esc(linea)}</text>`);
      });
    }
  }
  for (const c of chapas) {
    p.push(`<circle class="chapa${c.ia ? ' chapa-ia' : ''}" cx="${c.x}" cy="${c.y}" r="19"/><text class="chapa-t" x="${c.x}" y="${c.y + 7.5}" text-anchor="middle">${c.n}</text>`);
  }
  p.push('</svg>');
  return p.join('');
}

// ───────────── textos por flujo ─────────────
const EXPLICA = {
  '1-recepcionista-ia': {
    resumen: 'Una persona escribe en la web de la academia y, en unos segundos, recibe por correo una respuesta hecha a su medida. Secretaría recibe un aviso con la urgencia y el resumen. Si la IA falla, la persona recibe una respuesta de reserva y la consulta no se pierde.',
    web: 'web/contacto-academia.html',
    probar: [
      'Abre el flujo y pulsa <b>Execute workflow</b>. El primer bloque se queda esperando.',
      'Abre <code>web/contacto-academia.html</code> con doble clic. Pulsa uno de los ejemplos, escribe tu correo y envía.',
      'En n8n los bloques se van poniendo en verde. En la web aparece el mensaje de gracias con la categoría y la urgencia que ha decidido la IA, y debajo el correo de respuesta tal como se ha enviado.',
      'Mira tu bandeja: tienes el aviso para secretaría y la respuesta al alumno.',
      'Si en la web, en lugar de la clasificación, aparece un aviso de «respuesta automática», la IA no ha respondido y ha entrado la respuesta de reserva. Lo más habitual al principio es que falte elegir la credencial en el bloque Gemini.',
    ],
    truco: 'Envía primero el ejemplo «Precios» y después «Queja urgente»: se ve cómo cambian la urgencia y el tono de la respuesta.',
    bloques: {
      webhook: 'Webhook: una dirección que se queda escuchando. La web le envía el nombre, el correo, el curso y el mensaje.',
      agente: 'El agente de IA. Lee la consulta y, con la información de la academia que lleva en su mensaje de sistema, la clasifica y redacta la respuesta. Si falla, lo reintenta solo hasta tres veces.',
      gemini: 'El modelo de lenguaje que piensa por el agente.',
      parser: 'Obliga a la IA a contestar en campos separados (categoría, urgencia, asunto, respuesta y resumen) para poder usarlos en los bloques siguientes.',
      preparar: 'Deja la respuesta lista para los bloques de salida. Si la IA ha contestado, pasa sus campos tal cual; si ha fallado las tres veces, pone una respuesta de reserva y marca la consulta como urgente.',
      gmailSecretaria: 'Envía un aviso interno con la urgencia, la categoría y el resumen. Va primero para que la consulta quede registrada aunque el correo del alumno esté mal escrito.',
      gmailAlumno: 'Envía por Gmail la respuesta a quien escribió.',
      respond: 'Devuelve el resultado a la página, que muestra el mensaje de gracias y el correo que se ha enviado.',
    },
  },
  '2-redactor-de-posts': {
    resumen: 'Escribes un tema en una mini-web. El flujo busca titulares de la última semana con una petición HTTP, la IA redacta un post para LinkedIn apoyado en ellos, y el post aparece en la web y llega por correo.',
    web: 'web/redactor-posts.html',
    probar: [
      'Abre el flujo y pulsa <b>Execute workflow</b>.',
      'Abre <code>web/redactor-posts.html</code>, elige un tema, un tono y tu correo, y pulsa «Redactar post».',
      'En unos segundos el post aparece a la derecha, con los titulares en los que se ha apoyado, y te llega también por correo.',
    ],
    truco: 'Pide al público un tema de actualidad y escríbelo tal cual: los titulares son reales y de esta semana.',
    bloques: {
      webhook: 'Webhook: recibe el tema, el tono y el correo desde la mini-web.',
      http: 'Petición HTTP a Google Noticias con el tema como búsqueda, limitada a la última semana. Devuelve los titulares en formato XML. Si no contesta en unos segundos, el flujo sigue sin titulares.',
      xml: 'Convierte ese XML en datos que n8n entiende.',
      titulares: 'Se queda con los cinco primeros titulares y sus enlaces.',
      agente: 'El agente de IA. Escribe el post con el tono pedido, apoyándose en los titulares.',
      gemini: 'El modelo de lenguaje que piensa por el agente.',
      gmail: 'Manda el post por Gmail, con los titulares usados.',
      respond: 'Devuelve el post a la página para que aparezca al momento.',
    },
  },
  '3-resumen-varios-gmail': {
    resumen: 'Lee los correos recibidos en las últimas 24 horas en dos cuentas de Gmail. La IA separa lo urgente, lo pendiente y lo informativo de cada una, y te llega un único correo con el resumen.',
    web: null,
    probar: [
      'Abre el flujo y pulsa <b>Execute workflow</b>. No hace falta esperar a las 8:00: el botón lo lanza en el momento.',
      'Las dos cuentas se leen a la vez, se unen y pasan por la IA.',
      'Mira tu bandeja: tienes un correo «Resumen de tus correos» con una sección por cuenta.',
    ],
    truco: 'Antes de la clase, envíate un par de correos a cada cuenta (uno que suene urgente) para que el resumen tenga chicha.',
    bloques: {
      schedule: 'Disparador por horario: todos los días a las 8:00, en la zona horaria que tenga puesta el flujo. En directo se lanza con Execute workflow.',
      gmail1: 'Trae los correos recibidos en las últimas 24 horas en la primera cuenta, sin promociones, redes sociales ni lo que has enviado tú.',
      etiqueta1: 'Apunta de qué cuenta viene cada correo y se queda con el remitente, el asunto y el extracto.',
      gmail2: 'Lo mismo, con la segunda cuenta.',
      etiqueta2: 'Lo mismo, con el nombre de la segunda cuenta.',
      merge: 'Junta las dos ramas en una sola.',
      lista: 'Convierte todos los correos en una única lista, para dársela a la IA de una vez.',
      agente: 'El agente de IA. Separa por cuenta lo urgente, lo pendiente y lo informativo.',
      gemini: 'El modelo de lenguaje que piensa por el agente.',
      enviar: 'Te manda un único correo con el resumen.',
    },
  },
};

const seccionFlujo = (flow, i) => {
  const e = EXPLICA[flow.key];
  const k = byKey(flow);
  const ps = pasos(flow);
  return `
  <section class="flujo" id="flujo-${i + 1}">
    <h3><span class="num">${i + 1}</span>${esc(flow.name.replace(/^\d+ · /, ''))}</h3>
    <p>${esc(e.resumen)}</p>
    <figure><img class="captura" src="img/${flow.key[0]}-para-montar.png" alt="El flujo ${esc(flow.name)} en n8n, en su versión para montar: los bloques colocados y sin unir"><figcaption>Así lo verás al abrir la versión «para montar»: los bloques en su sitio, sin unir, y a la derecha la nota roja con el orden.</figcaption></figure>
    <figure><div class="lienzo">${diagrama(flow)}</div><figcaption>Así queda terminado. Los números indican el orden en el que se unen los bloques; las líneas de puntos son las uniones del agente con su modelo.</figcaption></figure>
    <div class="dos">
      <div>
        <h4>Uniones, en orden</h4>
        <ol class="uniones">
          ${ps.map((x) => `<li><b>${esc(x.from)}</b> → <b>${esc(x.to)}</b>${x.nota ? ` <span class="nota">(${md(x.nota)})</span>` : ''}</li>`).join('\n          ')}
        </ol>
        <p class="truco"><b>Para lucirlo:</b> ${esc(e.truco)}</p>
      </div>
      <div>
        <h4>Qué hace cada bloque</h4>
        <dl class="bloques">
          ${flow.nodes.map((n) => `<dt>${esc(n.name)}</dt><dd>${esc(e.bloques[n.key])}</dd>`).join('\n          ')}
        </dl>
      </div>
    </div>
  </section>`;
};

const pruebaFlujo = (flow, i) => {
  const e = EXPLICA[flow.key];
  return `
    <h3><span class="num">${i + 1}</span>${esc(flow.name.replace(/^\d+ · /, ''))}</h3>
    <ol>${e.probar.map((x) => `<li>${x}</li>`).join('')}</ol>`;
};

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Guía · Tres flujos de n8n con IA</title>
<style>
  :root {
    --bg: #f6f6f3; --papel: #ffffff; --tinta: #15171c; --texto: #3a4150; --suave: #6b7280; --borde: #e3e3de;
    --acento: #4338ca; --acento-bg: #eef2ff; --ok: #047857; --ok-bg: #ecfdf5; --aviso: #92400e; --aviso-bg: #fffbeb; --cod: #efefec;
    --m-azul: #e6effd; --m-morado: #eee9fd; --m-verde: #e3f4e9; --m-gris: #ededea;
    --nodo: #ffffff; --nodo-borde: #a3a9b5; --linea: #7b8494; --chapa: #1f2937; --chapa-ia: #6d28d9;
    --c-inicio: #c2410c; --c-ia: #6d28d9; --c-gmail: #b91c1c; --c-http: #1d4ed8; --c-datos: #475569; --c-fin: #0f766e;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #101216; --papel: #171a20; --tinta: #f2f4f7; --texto: #c9d0da; --suave: #95a0ae; --borde: #2a2f38;
      --acento: #a5b4fc; --acento-bg: #20254a; --ok: #6ee7b7; --ok-bg: #0e2a21; --aviso: #fcd34d; --aviso-bg: #2f240c; --cod: #23272f;
      --m-azul: #19263f; --m-morado: #272144; --m-verde: #14301f; --m-gris: #22252b;
      --nodo: #1d2129; --nodo-borde: #76808f; --linea: #8d97a6; --chapa: #e5e7eb; --chapa-ia: #c4b5fd;
      --c-inicio: #fdba74; --c-ia: #c4b5fd; --c-gmail: #fca5a5; --c-http: #93c5fd; --c-datos: #cbd5e1; --c-fin: #5eead4;
    }
    .chapa-t { fill: #111827 !important; }
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; background: var(--bg); color: var(--texto); font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; }
  .pagina { max-width: 1060px; margin: 0 auto; padding: 40px 20px 64px; }
  header.portada { margin: 0 0 28px; }
  .sobre { font-size: 13px; font-weight: 600; letter-spacing: .04em; color: var(--acento); margin: 0 0 8px; }
  h1 { font-size: 36px; line-height: 1.12; letter-spacing: -0.02em; color: var(--tinta); margin: 0 0 12px; }
  .entrada { font-size: 18px; max-width: 68ch; margin: 0 0 20px; }
  nav.indice { display: flex; flex-wrap: wrap; gap: 8px; }
  nav.indice a { font-size: 14px; color: var(--acento); background: var(--acento-bg); border-radius: 999px; padding: 4px 14px; text-decoration: none; }
  nav.indice a:hover { text-decoration: underline; }
  section.bloque { background: var(--papel); border: 1px solid var(--borde); border-radius: 16px; padding: 28px 30px; margin: 0 0 20px; }
  h2 { font-size: 24px; line-height: 1.2; color: var(--tinta); margin: 0 0 6px; letter-spacing: -0.01em; }
  h2 + p.sub { margin: 0 0 18px; color: var(--suave); }
  h3 { font-size: 19px; color: var(--tinta); margin: 26px 0 8px; display: flex; align-items: center; gap: 10px; }
  h4 { font-size: 15px; color: var(--tinta); margin: 0 0 8px; }
  .num { flex: none; width: 28px; height: 28px; border-radius: 50%; background: var(--acento); color: var(--papel); display: inline-grid; place-items: center; font-size: 15px; font-weight: 700; }
  p { margin: 0 0 12px; }
  ol, ul { margin: 0 0 12px; padding-left: 22px; }
  li { margin: 0 0 6px; }
  code { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: .9em; background: var(--cod); color: var(--tinta); padding: 1px 6px; border-radius: 6px; overflow-wrap: anywhere; }
  a { color: var(--acento); }
  table { width: 100%; border-collapse: collapse; font-size: 15px; margin: 0 0 12px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--borde); vertical-align: top; }
  th { color: var(--suave); font-weight: 600; font-size: 13px; }
  .tabla { overflow-x: auto; }
  .archivos td:first-child { white-space: nowrap; }
  .archivos td:first-child code { display: inline-block; margin: 1px 0; }
  .caja { border-radius: 12px; padding: 12px 16px; margin: 0 0 14px; font-size: 15px; }
  .caja.ok { background: var(--ok-bg); color: var(--ok); }
  .caja.aviso { background: var(--aviso-bg); color: var(--aviso); }
  .caja.info { background: var(--acento-bg); color: var(--acento); }
  .caja b { color: inherit; }
  .flujo { border-top: 1px solid var(--borde); margin-top: 26px; padding-top: 4px; }
  .flujo:first-of-type { border-top: 0; margin-top: 0; }
  figure { margin: 14px 0 18px; }
  .lienzo { overflow-x: auto; border: 1px solid var(--borde); border-radius: 14px; background: var(--bg); padding: 6px; }
  .lienzo svg { display: block; width: 100%; min-width: 760px; height: auto; }
  img.captura { display: block; width: 100%; height: auto; border: 1px solid var(--borde); border-radius: 14px; }
  figcaption { font-size: 13.5px; color: var(--suave); margin-top: 8px; }
  .dos { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 28px; }
  .uniones li { margin-bottom: 8px; }
  .uniones .nota { color: var(--suave); }
  .truco { font-size: 15px; background: var(--aviso-bg); color: var(--aviso); border-radius: 12px; padding: 10px 14px; margin-top: 14px; }
  dl.bloques { margin: 0; display: grid; grid-template-columns: minmax(120px, auto) minmax(0, 1fr); gap: 8px 16px; font-size: 15px; }
  dl.bloques dt { color: var(--tinta); font-weight: 600; }
  dl.bloques dd { margin: 0; }
  .marco { stroke: none; }
  .m-azul { fill: var(--m-azul); } .m-morado { fill: var(--m-morado); } .m-verde { fill: var(--m-verde); } .m-gris { fill: var(--m-gris); }
  .marco-t { font-size: 29px; font-weight: 600; fill: var(--tinta); }
  .nodo { fill: var(--nodo); stroke: var(--nodo-borde); stroke-width: 2.5; }
  .nombre { font-size: 25px; font-weight: 500; fill: var(--tinta); }
  .linea { fill: none; stroke: var(--linea); stroke-width: 3; }
  .linea.ia { stroke-dasharray: 3 9; stroke-linecap: round; stroke: var(--chapa-ia); }
  .chapa { fill: var(--chapa); } .chapa-ia { fill: var(--chapa-ia); }
  .chapa-t { font-size: 22px; font-weight: 700; fill: #ffffff; }
  .k-inicio { color: var(--c-inicio); } .k-ia { color: var(--c-ia); } .k-gmail { color: var(--c-gmail); } .k-http { color: var(--c-http); } .k-datos { color: var(--c-datos); } .k-fin { color: var(--c-fin); }
  footer { font-size: 13.5px; color: var(--suave); margin-top: 24px; }
  @media (max-width: 820px) { .dos { grid-template-columns: minmax(0, 1fr); gap: 18px; } h1 { font-size: 29px; } section.bloque { padding: 22px 18px; } dl.bloques { grid-template-columns: minmax(0, 1fr); gap: 2px 0; } dl.bloques dd { margin-bottom: 8px; } }
  @media print { body { background: #fff; } section.bloque { break-inside: avoid-page; border-color: #ccc; } .flujo { break-inside: avoid-page; } nav.indice { display: none; } }
</style>
</head>
<body>
<div class="pagina">

<header class="portada">
  <p class="sobre">Proyecto de n8n</p>
  <h1>Tres flujos de n8n con IA, listos para enseñar en directo</h1>
  <p class="entrada">Cada flujo viene en dos versiones: una <b>terminada</b>, que ya funciona, y otra <b>para montar</b>, con los mismos bloques ya configurados pero sin unir, para que los conectes arrastrando delante de la clase.</p>
  <nav class="indice" aria-label="Índice">
    <a href="#carpeta">1 · Qué hay en la carpeta</a>
    <a href="#preparacion">2 · Preparación</a>
    <a href="#probar">3 · Probar</a>
    <a href="#directo">4 · Guion para el directo</a>
    <a href="#protegidos">5 · Cómo están protegidos</a>
    <a href="#fallos">6 · Si algo falla</a>
    <a href="#ampliar">7 · Para ampliarlo</a>
  </nav>
</header>

<section class="bloque" id="carpeta">
  <h2>1 · Qué hay en la carpeta</h2>
  <p class="sub">Todo lo que necesitas está aquí; no hay que instalar nada más que tu n8n.</p>
  <div class="tabla"><table class="archivos">
    <thead><tr><th>Archivo</th><th>Para qué sirve</th></tr></thead>
    <tbody>
      ${flows.map((f) => `<tr><td><code>flujos/${f.key}-terminado.json</code><br><code>flujos/${f.key}-para-montar.json</code></td><td><b>${esc(f.name.replace(/^\d+ · /, ''))}.</b> ${esc(EXPLICA[f.key].resumen)}</td></tr>`).join('\n      ')}
      <tr><td><code>flujos/ensayo-sin-conexion/</code></td><td><b>Copias de ensayo.</b> Los mismos tres flujos con la IA y Gmail simulados, para ensayar sin credenciales y como plan B si en clase falla internet. Se explican en el apartado 3.</td></tr>
      <tr><td><code>web/contacto-academia.html</code></td><td>La página de contacto de la academia inventada. Envía la consulta al flujo 1 y enseña la respuesta de la IA.</td></tr>
      <tr><td><code>web/redactor-posts.html</code></td><td>La mini-web donde se escribe el tema. Envía el tema al flujo 2 y muestra el post.</td></tr>
      <tr><td><code>guia.html</code> e <code>img/</code></td><td>Esta guía y sus capturas.</td></tr>
    </tbody>
  </table></div>
  <p>Entre los tres flujos se usa todo lo que habéis visto en clase: <b>agentes de IA</b> en los tres, <b>Gmail</b> en los tres (leer y enviar), <b>webhooks</b> en el 1 y el 2, y <b>peticiones HTTP</b> en el 2.</p>
</section>

<section class="bloque" id="preparacion">
  <h2>2 · Preparación</h2>
  <p class="sub">Se hace una sola vez, con calma, antes de la clase. Unos 15 minutos.</p>

  <h3><span class="num">1</span>Importa los seis flujos</h3>
  <ol>
    <li>En n8n, crea un flujo nuevo (<b>Add workflow</b>).</li>
    <li>Abre el menú de los tres puntos de arriba a la derecha y elige <b>Import</b> → <b>From file</b>. En versiones anteriores de n8n la opción se llama <b>Import from File</b>.</li>
    <li>Elige un archivo de la carpeta <code>flujos</code>. Las versiones recientes de n8n lo guardan solas; en las anteriores, guarda con <b>Ctrl + S</b>.</li>
    <li>Repite con los otros cinco. Cada uno se guarda como un flujo distinto en tu n8n.</li>
  </ol>

  <h3><span class="num">2</span>Elige las credenciales</h3>
  <p>Los archivos no llevan contraseñas ni claves. Al importar, los bloques de Gemini y de Gmail aparecen con un aviso hasta que eliges tu credencial: abre el bloque y selecciónala en el desplegable de credencial, arriba del todo.</p>
  <div class="caja aviso"><b>Si n8n las elige solo.</b> Las versiones recientes, al importar, ponen ellas mismas una credencial que ya tengas y avisan con el mensaje «Credentials auto-added». Revísalo bloque a bloque: en el flujo 3 puede poner la misma cuenta de Gmail en <b>Leer cuenta 1</b> y en <b>Leer cuenta 2</b>, y la segunda hay que cambiarla a mano.</div>
  <div class="tabla"><table>
    <thead><tr><th>Bloque</th><th>Qué elegir</th></tr></thead>
    <tbody>
      <tr><td><b>Gemini</b> (los tres flujos)</td><td>Tu credencial de Google Gemini, la misma de clase. En <b>Model</b> viene <code>gemini-flash-latest</code>, un nombre que apunta siempre al modelo Flash más reciente de Google, así que no caduca. Si en clase usáis otro, elígelo en la lista.</td></tr>
      <tr><td><b>Responder al alumno</b>, <b>Avisar a secretaría</b>, <b>Enviar el post</b>, <b>Enviar resumen</b></td><td>Tu cuenta de Gmail.</td></tr>
      <tr><td><b>Leer cuenta 1</b> y <b>Leer cuenta 2</b> (flujo 3)</td><td>Una cuenta de Gmail distinta en cada uno.</td></tr>
    </tbody>
  </table></div>
  <div class="caja info"><b>Segunda cuenta de Gmail.</b> En el bloque <b>Leer cuenta 2</b>, elige <b>Create new credential</b>, pega el mismo Client ID y Client Secret que usaste para la primera e inicia sesión con la otra cuenta. Si Google responde que el acceso está bloqueado, entra en Google Cloud, abre <b>Google Auth Platform</b> → <b>Audience</b> (Público) y añade esa dirección en <b>Test users</b> (Usuarios de prueba).</div>

  <h3><span class="num">3</span>Pon tu correo y los nombres de tus cuentas</h3>
  <ul>
    <li>Flujo 1, bloque <b>Avisar a secretaría</b>: cambia <code>${MI_CORREO}</code> por tu correo en el campo <b>To</b>.</li>
    <li>Flujo 3, bloque <b>Enviar resumen</b>: lo mismo.</li>
    <li>Flujo 3, bloques <b>Etiquetar cuenta 1</b> y <b>Etiquetar cuenta 2</b>: cambia «Personal» y «Trabajo» por el nombre que quieras dar a cada cuenta.</li>
    <li>Flujo 3, hora del resumen: n8n no conserva la zona horaria al importar un flujo, así que las 8:00 serían las de la zona que tenga tu n8n por defecto (si nunca la has cambiado, la de Nueva York). Abre el menú de los tres puntos → <b>Settings</b>, elige la tuya en <b>Timezone</b> (en la península, <code>Europe/Madrid</code>) y pulsa <b>Save</b>.</li>
  </ul>
  <div class="caja aviso"><b>Hazlo en las dos versiones.</b> La versión terminada y la versión para montar son flujos distintos, así que las credenciales y tu correo hay que ponerlos en ambas. Cada flujo lleva una nota amarilla con estos mismos pasos.</div>
</section>

<section class="bloque" id="probar">
  <h2>3 · Probar que todo funciona</h2>
  <p class="sub">Con las versiones terminadas, antes de la clase.</p>
  <div class="caja ok"><b>Qué está comprobado.</b> En n8n 2.42.6 se ha probado importar los archivos desde el menú, montar las tres versiones «para montar» arrastrando las uniones en el orden del guion y ejecutar los tres flujos con el agente de IA funcionando contra una IA simulada. También lo que pasa cuando algo va mal: la IA contesta mal una vez (se reintenta sola), la IA no responde de ninguna manera (sale la respuesta de reserva) y Google Noticias no contesta (el post se escribe sin titulares). Y las dos páginas web, la petición de noticias y los casos raros: texto con etiquetas, campos vacíos, mensajes larguísimos y cuentas sin correo. Lo que no se ha podido probar es Gemini y Gmail de verdad, porque dependen de tus credenciales: haz una prueba real de cada flujo antes de la clase.</div>
  ${flows.map(pruebaFlujo).join('\n')}
  <h3>Ensayar sin credenciales (y plan B sin internet)</h3>
  <p>En <code>flujos/ensayo-sin-conexion</code> hay una copia de cada flujo que funciona sin Gemini ni Gmail. Los bloques de IA y de Gmail llevan <b>datos fijados</b> (se reconocen por el icono de la chincheta y el borde morado): n8n no los ejecuta y usa en su lugar el resultado de ejemplo que llevan guardado. El resto del flujo se ejecuta de verdad.</p>
  <figure><img class="captura" src="img/ensayo-ejecutado.png" alt="La copia de ensayo del flujo de la recepcionista después de ejecutarse: los bloques normales en verde y los fijados en morado"><figcaption>La copia de ensayo, ejecutada. En verde, lo que se ha ejecutado; en morado, los bloques con datos fijados.</figcaption></figure>
  <ul>
    <li><b>Para ensayar:</b> impórtalas igual que las demás, pulsa <b>Execute workflow</b> y usa las páginas web. No hace falta elegir credenciales.</li>
    <li><b>Como plan B:</b> si en clase se cae internet o Gemini no responde, abre la copia de ensayo y sigue con ella. Di que es un ensayo: la respuesta de la IA es siempre el mismo ejemplo, escribas lo que escribas.</li>
    <li><b>Para explicarlo:</b> fijar datos es un recurso de n8n para probar un flujo sin gastar llamadas a la IA. Se quita abriendo el bloque y pulsando la chincheta.</li>
  </ul>
  <figure><img class="captura" src="img/pagina-respuesta.png" alt="La página de contacto después de enviar una consulta: la clasificación de la IA y el correo de respuesta"><figcaption>Lo que enseña la página de contacto cuando el flujo responde: la categoría, la urgencia y el correo que ha escrito la IA.</figcaption></figure>

  <h3>Prueba o publicado</h3>
  <p>Las dos páginas web tienen abajo un desplegable, <b>Conexión con n8n</b>, con la dirección de tu n8n (<code>http://localhost:5678</code>) y el modo:</p>
  <ul>
    <li><b>Prueba</b> (el que viene puesto): la web habla con el flujo que tienes abierto después de pulsar <b>Execute workflow</b>, y ves los bloques ejecutarse en pantalla. Es el modo para el directo. n8n escucha una sola vez por cada pulsación, así que pulsa el botón antes de cada envío.</li>
    <li><b>Publicado</b>: la web habla con el flujo publicado (botón <b>Publish</b>; en versiones anteriores, el interruptor <b>Active</b>), que funciona siempre sin pulsar nada, pero no se ve en el lienzo. Publica solo una de las dos versiones de cada flujo: comparten la misma dirección de webhook.</li>
  </ul>
</section>

<section class="bloque" id="directo">
  <h2>4 · Guion para el directo</h2>
  <p class="sub">Abre la versión «para montar» de cada flujo. Los bloques están colocados en su sitio y configurados: solo falta unirlos.</p>
  <h3>Cómo se unen los bloques</h3>
  <ul>
    <li><b>Unión normal:</b> arrastra desde el punto del lado derecho de un bloque hasta el lado izquierdo del siguiente.</li>
    <li><b>Modelo y formato del agente:</b> los bloques redondos (Gemini y Formato de salida) se unen por arriba. Arrastra desde su rombo superior hasta la entrada del agente que lleva su nombre: <i>Chat Model</i> o <i>Output Parser</i>.</li>
    <li><b>Unir cuentas</b> tiene dos entradas a la izquierda: una para cada cuenta.</li>
    <li>Al terminar, pulsa <b>Execute workflow</b> y haz la prueba igual que en el apartado 3.</li>
  </ul>
  <div class="caja aviso"><b>Ensaya en una copia.</b> Las versiones recientes de n8n guardan los cambios solas. Si unes los bloques mientras ensayas, la versión «para montar» se queda unida y el día de la clase ya no habrá nada que montar. Antes de ensayar, abre el menú de los tres puntos y elige <b>Duplicate</b>: ensaya en el duplicado y deja el original sin tocar. Si ya lo has unido, importa otra vez el archivo «para montar».</div>
  <div class="caja info"><b>Plan B.</b> Si en directo una unión no sale, abre la versión terminada del mismo flujo y sigue desde ahí: es idéntica y ya la has probado. Si lo que falla es internet o Gemini, usa la copia de ensayo sin conexión.</div>
  ${flows.map(seccionFlujo).join('\n')}
</section>

<section class="bloque" id="protegidos">
  <h2>5 · Cómo están protegidos los flujos</h2>
  <p class="sub">Lo que distingue un flujo de clase de uno que se puede dejar funcionando. Sirve para contestar cuando alguien pregunte «¿y si falla?».</p>
  <div class="tabla"><table>
    <thead><tr><th>Si pasa esto</th><th>El flujo hace esto</th></tr></thead>
    <tbody>
      <tr><td>La IA da un error puntual o contesta sin el formato pedido.</td><td>El agente lo reintenta solo: hasta tres veces en los flujos 1 y 2, donde hay alguien esperando en la web, y hasta cinco en el resumen diario.</td></tr>
      <tr><td>La IA no responde de ninguna manera (flujo 1).</td><td>El bloque <b>Preparar respuesta</b> pone una respuesta de reserva. La persona recibe su correo, secretaría recibe la consulta marcada como urgente y con el motivo del fallo, y la web avisa de que la respuesta es automática. En las pruebas, con una IA simulada, tarda unos cinco segundos.</td></tr>
      <tr><td>Google Noticias no contesta o no hay noticias de esa semana (flujo 2).</td><td>El post se escribe igualmente, sin titulares, y el correo no enseña un apartado vacío. La petición se intenta dos veces, con un límite de 6 segundos cada una, para que la web no se quede colgada. Por eso la copia de ensayo de este flujo funciona también sin internet.</td></tr>
      <tr><td>El correo de quien escribe está mal puesto (flujo 1).</td><td>El aviso a secretaría sale antes que la respuesta al alumno, así que la consulta queda registrada aunque ese segundo envío falle.</td></tr>
      <tr><td>Alguien escribe código o instrucciones para la IA en el formulario.</td><td>Las etiquetas se neutralizan antes de entrar en un correo, el mensaje se recorta a 2.000 caracteres antes de ir a la IA, y la IA tiene instrucciones de no seguir órdenes que vengan dentro de un mensaje, de un titular o de un correo.</td></tr>
      <tr><td>Gmail falla al leer una cuenta (flujo 3).</td><td>Se reintenta hasta tres veces. Los envíos de correo no se reintentan nunca: un envío repetido puede hacer que el correo salga dos veces.</td></tr>
      <tr><td>Google retira un modelo de Gemini.</td><td>Los tres flujos usan <code>gemini-flash-latest</code>, que apunta siempre al Flash más reciente, en lugar de un modelo con fecha de retirada.</td></tr>
      <tr><td>Ayer ya te llegó un resumen (flujo 3).</td><td>La búsqueda lleva <code>-from:me</code>: deja fuera lo que ha enviado la propia cuenta, incluido el resumen del día anterior.</td></tr>
    </tbody>
  </table></div>
  <figure><img class="captura" src="img/pagina-reserva.png" alt="La página de contacto cuando la IA no ha respondido: avisa de que la respuesta es automática y enseña el correo de reserva"><figcaption>Lo que ve la persona si la IA no responde: el aviso de que la respuesta es automática y el correo de reserva. Si quieres enseñarlo en clase, crea una segunda credencial de Gemini con la clave mal escrita, elígela un momento en el bloque Gemini y envía una consulta.</figcaption></figure>
</section>

<section class="bloque" id="fallos">
  <h2>6 · Si algo falla</h2>
  <div class="tabla"><table>
    <thead><tr><th>Lo que ves</th><th>Qué hacer</th></tr></thead>
    <tbody>
      <tr><td>La web dice que no puede conectar con n8n.</td><td>Pulsa <b>Execute workflow</b> en el flujo y vuelve a enviar: en modo prueba solo escucha una vez. Comprueba también que n8n está abierto y que la dirección del desplegable es la de tu n8n.</td></tr>
      <tr><td>El flujo se ejecuta pero no se ve en el lienzo.</td><td>La web está en modo <b>Publicado</b>. Cámbiala a <b>Prueba</b> en «Conexión con n8n».</td></tr>
      <tr><td>El lienzo sale rayado, pone «Editing in another tab» y no deja unir bloques.</td><td>Tienes el mismo flujo abierto en otra pestaña. Pulsa <b>Edit here</b> o cierra la otra pestaña.</td></tr>
      <tr><td>Un bloque de Gmail se pone en rojo.</td><td>No tiene cuenta elegida o la conexión ha caducado. Abre el bloque, elige la credencial y, si hace falta, vuelve a iniciar sesión con Google.</td></tr>
      <tr><td>El bloque Gemini se pone en rojo.</td><td>Revisa la credencial. Si el mensaje dice que el modelo no existe o no está disponible, elige otro en la lista <b>Model</b>. Si habla de cuota o de límite, espera un minuto y repite. Para no parar la clase, sigue con la copia de ensayo sin conexión.</td></tr>
      <tr><td>En el flujo 1, la web dice que has recibido una respuesta automática.</td><td>La IA ha fallado tres veces seguidas y ha entrado la respuesta de reserva. El flujo termina bien, pero en el lienzo el bloque <b>Gemini</b> queda en rojo. El motivo está en el aviso a secretaría y en la salida del bloque <b>Recepcionista IA</b>, en el campo <code>error</code>. Lo habitual es la credencial, el modelo o el límite de peticiones de Gemini.</td></tr>
      <tr><td>El post sale sin titulares.</td><td>Google Noticias no ha encontrado nada de la última semana para ese tema, o no ha contestado a tiempo. El post se escribe igualmente; prueba con un tema más general.</td></tr>
      <tr><td>El resumen dice «Sin novedades».</td><td>Esa cuenta no ha recibido correos en las últimas 24 horas. Envíate alguno desde otra cuenta o, en <b>Leer cuenta</b>, cambia <code>newer_than:1d</code> por <code>newer_than:3d</code> en el campo <b>Search</b>.</td></tr>
      <tr><td>El resumen no llega a las 8:00.</td><td>El disparador por horario solo funciona con el flujo publicado (botón <b>Publish</b>) y con n8n abierto a esa hora. Si llega a otra hora, falta poner la zona horaria: menú de los tres puntos → <b>Settings</b> → <b>Timezone</b>.</td></tr>
      <tr><td>Al publicar, n8n avisa de un conflicto de webhook.</td><td>Las dos versiones del flujo usan la misma dirección. Publica solo una.</td></tr>
    </tbody>
  </table></div>
</section>

<section class="bloque" id="ampliar">
  <h2>7 · Para ampliarlo</h2>
  <ul>
    <li><b>Otra respuesta de reserva:</b> en el flujo 1, abre <b>Preparar respuesta</b> y cambia el texto del campo <code>respuesta</code>, el que va después de <code>||</code>.</li>
    <li><b>Titulares de más o menos días:</b> en el flujo 2, abre <b>Buscar noticias</b> y cambia <code>when:7d</code> por <code>when:1d</code> (solo hoy) o <code>when:30d</code> (el último mes).</li>
    <li><b>Que te avise cuando un flujo falle:</b> crea un flujo nuevo con el disparador <b>Error Trigger</b> seguido de un bloque de Gmail, y elígelo en el menú de los tres puntos → <b>Settings</b> → <b>Error Workflow</b> de cada flujo. Es la forma habitual de enterarse de los fallos en flujos que funcionan solos, como el 3.</li>
    <li><b>Otra academia u otro negocio:</b> en el flujo 1, abre <b>Recepcionista IA</b> y cambia el texto de <b>System Message</b>: ahí están los cursos, los precios y los horarios. Para que la web coincida, cambia también los textos de <code>web/contacto-academia.html</code>.</li>
    <li><b>Otra red social:</b> en el flujo 2, abre <b>Redactor IA</b> y adapta las instrucciones de <b>System Message</b> (longitud, estructura, hashtags).</li>
    <li><b>Una tercera cuenta de Gmail:</b> en el flujo 3, duplica <b>Leer cuenta 2</b> y <b>Etiquetar cuenta 2</b>, elige la nueva credencial, abre <b>Unir cuentas</b> y sube <b>Number of Inputs</b> a 3. Une la nueva rama a la tercera entrada.</li>
    <li><b>Solo correos sin leer:</b> en <b>Leer cuenta</b>, añade <code>is:unread</code> al campo <b>Search</b>. Funciona igual que el buscador de Gmail.</li>
  </ul>
</section>

<footer>Academia Lumen es un negocio inventado para la demostración. Los flujos usan versiones de bloque compatibles con n8n 2.x.</footer>
</div>
</body>
</html>
`;

fs.writeFileSync(path.join(OUT, 'guia.html'), html, 'utf8');
console.log('guia.html escrita:', html.length, 'caracteres');
