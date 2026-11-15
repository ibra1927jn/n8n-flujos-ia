// Genera los archivos de n8n a partir de flows.cjs.
// Uso: node build.cjs <carpeta-proyecto> <carpeta-pruebas>
const fs = require('fs');
const path = require('path');
const { T, uid, flows } = require('./flows.cjs');

const [OUT, TEST] = process.argv.slice(2);

const SIZE = { main: [96, 96], agent: [256, 96], sub: [80, 80] };
const sizeOf = (n) => (n.sub ? SIZE.sub : n.t === 'agent' ? SIZE.agent : SIZE.main);
const byKey = (flow) => Object.fromEntries(flow.nodes.map((n) => [n.key, n]));

// ── geometría de marcos y notas ──
const HEAD = 144; // espacio para el título del marco
const FOOT = 96; // espacio para el nombre que n8n pinta bajo cada bloque
const PAD = 80;

function layout(flow) {
  const top = Math.min(...flow.nodes.map((n) => n.pos[1])) - HEAD;
  const bottom = Math.max(...flow.nodes.map((n) => n.pos[1] + sizeOf(n)[1])) + FOOT;
  const k = byKey(flow);
  const frames = flow.frames.map((f) => {
    const ns = f.nodes.map((key) => k[key]);
    const x1 = Math.min(...ns.map((n) => n.pos[0])) - PAD;
    const x2 = Math.max(...ns.map((n) => n.pos[0] + sizeOf(n)[0])) + PAD;
    return { ...f, x: x1, y: top, w: x2 - x1, h: bottom - top };
  });
  return { top, bottom, left: frames[0].x, right: frames[frames.length - 1].x + frames[frames.length - 1].w, frames };
}

function estimateHeight(md, width) {
  // Medidas calibradas con el lienzo real de n8n 2.42: 21 por renglón, ~23 por punto de lista, ~28 por párrafo.
  // Se deja holgura de unos dos renglones para que nunca aparezca barra de desplazamiento en la nota.
  const cpl = Math.floor((width - 40) / 7.4);
  let h = 20;
  for (const line of md.split('\n')) {
    if (line.startsWith('## ')) { h += 44; continue; }
    if (line.trim() === '') continue;
    const plain = line.replace(/[*`]/g, '');
    h += Math.ceil(plain.length / cpl) * 21 + (/^\d+\. /.test(line) ? 2 : 7);
  }
  return Math.ceil((h + 12) / 16) * 16;
}

const leemeMd = (flow) =>
  [`## ${flow.leeme.titulo}`, flow.leeme.texto, '', '**Antes de usarlo**', ...flow.leeme.pasos.map((p, i) => `${i + 1}. ${p}`)].join('\n');

function pasos(flow) {
  const k = byKey(flow);
  return flow.links.map((l, i) => ({
    n: i + 1,
    from: k[l.from].name,
    to: k[l.to].name,
    nota: l.nota || '',
    type: l.type || 'main',
    fromKey: l.from,
    toKey: l.to,
  }));
}

const guionMd = (flow) =>
  [
    '## Guion para montarlo en directo',
    'Los bloques ya están configurados. Solo falta unirlos: arrastra desde el punto de salida de un bloque hasta el punto de entrada del siguiente, en este orden.',
    '',
    ...pasos(flow).map((p) => `${p.n}. **${p.from}** → **${p.to}**${p.nota ? ` (${p.nota})` : ''}`),
    '',
    'Al terminar, pulsa **Execute workflow** para probarlo.',
  ].join('\n');

// Segunda nota (roja) de cada variante.
const ensayoMd = (data) =>
  [
    '## Ensayo sin conexión',
    'Es el mismo flujo que el terminado, pero **la IA y Gmail no se ejecutan de verdad**: esos bloques llevan datos de ejemplo fijados (el icono de la chincheta). El resto de bloques sí se ejecuta.',
    '',
    'Sirve para ensayar sin credenciales y como plan B si en clase falla internet. ' + data.nota,
  ].join('\n');
const mockMd = () =>
  [
    '## Prueba con IA simulada',
    'Copia interna de pruebas: el bloque **Gemini** apunta a una IA simulada que corre en este ordenador, así que el agente se ejecuta de verdad. Los bloques de Gmail llevan datos fijados.',
  ].join('\n');
const SEGUNDA = {
  'para-montar': (flow) => ['Nota: guion', guionMd(flow)],
  ensayo: (flow, data) => ['Nota: ensayo sin conexión', ensayoMd(data)],
  mock: () => ['Nota: prueba con IA simulada', mockMd()],
};

function stickies(flow, variant, data) {
  const lay = layout(flow);
  const mk = (key, name, content, x, y, w, h, color) => ({
    parameters: { content, height: h, width: w, ...(color ? { color } : {}) },
    id: uid(`${flow.key}/${variant}/nota/${key}`),
    name,
    type: T.sticky[0],
    typeVersion: T.sticky[1],
    position: [x, y],
  });
  const out = [];
  const W = 720;
  const leeme = leemeMd(flow);
  const segunda = SEGUNDA[variant] ? SEGUNDA[variant](flow, data) : null;
  const hLeeme = estimateHeight(leeme, W);
  const h = segunda ? Math.max(hLeeme, estimateHeight(segunda[1], W)) : hLeeme;
  const y = lay.top - 32 - h;
  out.push(mk('leeme', 'Nota: léeme', leeme, lay.left, y, W, h, undefined));
  if (segunda) out.push(mk('guion', segunda[0], segunda[1], lay.left + W + 32, y, W, h, 3));
  lay.frames.forEach((f, i) => {
    out.push(mk(`marco${i + 1}`, `Nota: ${f.titulo}`, `## ${f.titulo}\n${f.texto}`, f.x, f.y, f.w, f.h, f.color));
  });
  return out;
}

// ── nodos ──
function nodeJson(flow, variant, n) {
  const [type, typeVersion] = T[n.t];
  let parameters = n.parameters ? structuredClone(n.parameters) : {};
  if (n.assignments) {
    parameters = {
      assignments: {
        assignments: n.assignments.map(([name, value, kind]) => ({
          id: uid(`${flow.key}/${variant}/${n.key}/${name}`),
          name,
          value,
          type: kind,
        })),
      },
      options: {},
    };
  }
  const out = { parameters, id: uid(`${flow.key}/${variant}/${n.key}`), name: n.name, type, typeVersion, position: n.pos, ...(n.extra || {}) };
  if (n.t === 'webhook') out.webhookId = uid(`${flow.key}/${variant}/${n.key}/webhook`);
  return out;
}

function connectionsJson(flow, links) {
  const k = byKey(flow);
  const c = {};
  for (const l of links) {
    const from = k[l.from].name;
    const to = k[l.to].name;
    const type = l.type || 'main';
    c[from] ??= {};
    c[from][type] ??= [];
    const outIdx = l.fromIndex || 0;
    while (c[from][type].length <= outIdx) c[from][type].push([]);
    c[from][type][outIdx].push({ node: to, type, index: l.toIndex || 0 });
  }
  return c;
}

// «flow.ajustes» son los ajustes propios del flujo (por ejemplo, la zona horaria del que va por horario).
const wrap = (flow, name, nodes, connections, extra = {}) => ({
  name,
  nodes,
  connections,
  pinData: {},
  settings: { executionOrder: 'v1', ...(flow.ajustes || {}) },
  ...extra,
});

function terminado(flow) {
  const v = 'terminado';
  return wrap(flow, `${flow.name} (terminado)`, [...stickies(flow, v), ...flow.nodes.map((n) => nodeJson(flow, v, n))], connectionsJson(flow, flow.links));
}

function paraMontar(flow) {
  const v = 'para-montar';
  return wrap(flow, `${flow.name} (para montar)`, [...stickies(flow, v), ...flow.nodes.map((n) => nodeJson(flow, v, n))], {});
}

// ── ensayo sin conexión (entregable): el flujo terminado, con datos fijados (pin) en IA y Gmail ──
function ensayo(flow, data) {
  const v = 'ensayo';
  const k = byKey(flow);
  const pinData = {};
  for (const [key, items] of Object.entries(data.pin)) pinData[k[key].name] = items.map((json) => ({ json }));
  return wrap(
    flow,
    `${flow.name} (ensayo sin conexión)`,
    [...stickies(flow, v, data), ...flow.nodes.map((n) => nodeJson(flow, v, n))],
    connectionsJson(flow, flow.links),
    { pinData },
  );
}

// ── prueba interna: el agente se ejecuta de verdad contra una IA simulada local; Gmail con datos fijados ──
const CRED_MOCK = { id: 'mockgemini000001', name: 'Gemini simulado (pruebas)' };
function mock(flow, idx, data) {
  const v = 'mock';
  const k = byKey(flow);
  const pinData = {};
  for (const [key, items] of Object.entries(data.pin)) if (k[key].t === 'gmail') pinData[k[key].name] = items.map((json) => ({ json }));
  const nodes = flow.nodes.map((n) => {
    const j = nodeJson(flow, v, n);
    if (n.t === 'gemini') j.credentials = { googlePalmApi: CRED_MOCK };
    return j;
  });
  return wrap(
    flow,
    `${flow.name} (prueba con IA simulada)`,
    [...stickies(flow, v, data), ...nodes],
    connectionsJson(flow, flow.links),
    { pinData, id: 'mock' + String(idx + 1).padStart(12, '0'), active: false },
  );
}

// ── prueba interna del montaje en directo: como «para montar» (sin uniones), pero ejecutable con la IA simulada ──
function montaje(flow, idx, data) {
  const w = mock(flow, idx, data);
  return { ...w, name: `${flow.name} (montaje de prueba)`, connections: {}, id: 'mont' + String(idx + 1).padStart(12, '0') };
}

// ── simulacro: mismas expresiones, sin credenciales ──
function simulacro(flow, idx) {
  const v = 'prueba';
  const setNode = (n, fields) => ({
    parameters: {
      assignments: { assignments: fields.map(([name, value, kind]) => ({ id: uid(`${flow.key}/${v}/${n.key}/${name}`), name, value, type: kind })) },
      options: {},
    },
    id: uid(`${flow.key}/${v}/${n.key}`),
    name: n.name,
    type: T.set[0],
    typeVersion: T.set[1],
    position: n.pos,
  });
  const nodes = [];
  for (const n of flow.nodes) {
    if (n.sub) continue;
    if (n.t === 'agent') {
      const j = setNode(n, [['prompt', n.parameters.text, 'string'], ['output', n.mock.salida, n.mock.tipo]]);
      // el sustituto del agente se comporta ante un fallo igual que el agente de verdad
      if (n.extra && n.extra.onError) j.onError = n.extra.onError;
      nodes.push(j);
    } else if (n.t === 'http') {
      // solo en el simulacro: con «_sinNoticias» la petición va a un puerto cerrado (el servidor rechaza la conexión) o,
      // con el valor «dns», a un nombre que no existe (lo que pasa cuando no hay internet), para probar que el flujo sigue sin titulares
      const j = nodeJson(flow, v, n);
      j.parameters.url = `={{ $json.body._sinNoticias === 'dns' ? 'http://noticias.invalid/rss' : $json.body._sinNoticias ? 'http://127.0.0.1:9/sin-noticias' : '${n.parameters.url}' }}`;
      nodes.push(j);
    } else if (n.t === 'gmail' && n.parameters.operation === 'getAll') {
      nodes.push({
        parameters: { jsCode: `return ${JSON.stringify(n.mock.items)}.map((json) => ({ json }));` },
        id: uid(`${flow.key}/${v}/${n.key}`),
        name: n.name,
        type: T.code[0],
        typeVersion: T.code[1],
        position: n.pos,
        alwaysOutputData: true,
      });
    } else if (n.t === 'gmail') {
      nodes.push(setNode(n, [['sendTo', n.parameters.sendTo, 'string'], ['subject', n.parameters.subject, 'string'], ['message', n.parameters.message, 'string']]));
    } else if (n.t === 'schedule') {
      nodes.push({
        parameters: { path: `prueba-${flow.key}`, responseMode: 'lastNode', options: {} },
        id: uid(`${flow.key}/${v}/${n.key}`),
        name: n.name,
        type: T.webhook[0],
        typeVersion: T.webhook[1],
        position: n.pos,
        webhookId: uid(`${flow.key}/${v}/${n.key}/webhook`),
      });
    } else if (n.t === 'respond') {
      const j = nodeJson(flow, v, n);
      j.parameters.responseBody = n.mockBody;
      nodes.push(j);
    } else {
      nodes.push(nodeJson(flow, v, n));
    }
  }
  const links = flow.links.filter((l) => !l.type || l.type === 'main');
  return wrap(flow, `[PRUEBA] ${flow.name}`, nodes, connectionsJson(flow, links), { id: `prueba0000000000${idx + 1}`.slice(-16), active: false });
}

// ── puente: el agente se ejecuta de verdad y sus peticiones van al buzón (contesta Claude en lugar de Gemini).
//    Los bloques de Gmail no envían ni leen: los de enviar apuntan lo que enviarían (destinatario, asunto y cuerpo)
//    y los de leer devuelven los correos que se les pasan en la petición. El envío y la lectura reales se hacen fuera de n8n. ──
function puente(flow, idx) {
  const v = 'puente';
  const disparador = flow.nodes.find((n) => n.t === 'webhook' || n.t === 'schedule');
  const captura = (n, fields) => ({
    parameters: { assignments: { assignments: fields.map(([name, value, kind]) => ({ id: uid(`${flow.key}/${v}/${n.key}/${name}`), name, value, type: kind })) }, options: {} },
    id: uid(`${flow.key}/${v}/${n.key}`), name: n.name, type: T.set[0], typeVersion: T.set[1], position: n.pos,
  });
  const nodes = [];
  let lecturas = 0;
  for (const n of flow.nodes) {
    if (n.t === 'gemini') {
      const j = nodeJson(flow, v, n);
      j.credentials = { googlePalmApi: CRED_MOCK };
      nodes.push(j);
    } else if (n.t === 'gmail' && n.parameters.operation === 'getAll') {
      lecturas++;
      nodes.push({
        parameters: { jsCode: `return ($('${disparador.name}').first().json.body.cuenta${lecturas} || []).map((json) => ({ json }));` },
        id: uid(`${flow.key}/${v}/${n.key}`), name: n.name, type: T.code[0], typeVersion: T.code[1], position: n.pos, alwaysOutputData: true,
      });
    } else if (n.t === 'gmail') {
      nodes.push(captura(n, [['sendTo', n.parameters.sendTo, 'string'], ['subject', n.parameters.subject, 'string'], ['message', n.parameters.message, 'string']]));
    } else if (n.t === 'schedule') {
      nodes.push({
        parameters: { httpMethod: 'POST', path: `puente-${flow.key}`, responseMode: 'lastNode', options: {} },
        id: uid(`${flow.key}/${v}/${n.key}`), name: n.name, type: T.webhook[0], typeVersion: T.webhook[1], position: n.pos,
        webhookId: uid(`${flow.key}/${v}/${n.key}/webhook`),
      });
    } else if (n.t === 'respond') {
      const j = nodeJson(flow, v, n);
      j.parameters.responseBody = n.mockBody;
      nodes.push(j);
    } else {
      nodes.push(nodeJson(flow, v, n));
    }
  }
  return wrap(flow, `${flow.name} (Claude en lugar de Gemini)`, nodes, connectionsJson(flow, flow.links), { id: 'puente' + String(idx + 1).padStart(10, '0'), active: false });
}

// ── escribir ──
if (require.main === module) {
if (!OUT || !TEST) { console.error('faltan carpetas'); process.exit(1); }
const write = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
};

const resumen = [];
flows.forEach((flow, i) => {
  const t = terminado(flow);
  const m = paraMontar(flow);
  const s = simulacro(flow, i);
  write(path.join(OUT, 'flujos', `${flow.key}-terminado.json`), t);
  write(path.join(OUT, 'flujos', `${flow.key}-para-montar.json`), m);
  write(path.join(TEST, 'simulacros', `${flow.key}-prueba.json`), s);
  const datos = require('./demo-data.cjs')[flow.key];
  write(path.join(OUT, 'flujos', 'ensayo-sin-conexion', `${flow.key}-ensayo.json`), ensayo(flow, datos));
  write(path.join(TEST, 'mock', `${flow.key}-mock.json`), mock(flow, i, datos));
  write(path.join(TEST, 'montaje', `${flow.key}-montaje.json`), montaje(flow, i, datos));
  write(path.join(TEST, 'puente', `${flow.key}-puente.json`), puente(flow, i));
  resumen.push({ key: flow.key, name: flow.name, nodos: flow.nodes.length, uniones: flow.links.length, notas: t.nodes.length - flow.nodes.length });
});
write(path.join(TEST, 'guion.json'), flows.map((f) => ({ key: f.key, name: f.name, leeme: f.leeme, pasos: pasos(f), layout: layout(f) })));
console.table(resumen);
}

module.exports = { layout, pasos, sizeOf, byKey, leemeMd, guionMd };
