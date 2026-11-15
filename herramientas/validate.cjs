// Valida los flujos contra las definiciones de nodos del n8n instalado.
// Uso: node validate.cjs <archivo.json> [...]
const fs = require('fs');
const path = require('path');
// n8n instalado de forma global con npm (npm install -g n8n)
const root = path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'n8n', 'node_modules');
const defs = [
  ...require(path.join(root, 'n8n-nodes-base/dist/types/nodes.json')).map((n) => ({ ...n, full: `n8n-nodes-base.${n.name}` })),
  ...require(path.join(root, '@n8n/n8n-nodes-langchain/dist/types/nodes.json')).map((n) => ({ ...n, full: `@n8n/n8n-nodes-langchain.${n.name}` })),
];
const versionsOf = (d) => (Array.isArray(d.version) ? d.version : [d.version]);

function cnd(cond, v) {
  if (typeof cond !== 'object' || cond === null) return cond === v;
  const c = cond._cnd;
  if (!c) return false;
  if ('gte' in c) return v >= c.gte;
  if ('lte' in c) return v <= c.lte;
  if ('gt' in c) return v > c.gt;
  if ('lt' in c) return v < c.lt;
  if ('eq' in c) return v === c.eq;
  if ('not' in c) return v !== c.not;
  if ('between' in c) return v >= c.between.from && v <= c.between.to;
  return false;
}
// ¿la propiedad existe para esta versión del nodo?
function versionOk(prop, version) {
  const d = prop.displayOptions;
  if (!d) return true;
  if (d.show && d.show['@version'] && !d.show['@version'].some((c) => cnd(c, version))) return false;
  if (d.hide && d.hide['@version'] && d.hide['@version'].some((c) => cnd(c, version))) return false;
  return true;
}
// ¿la propiedad se muestra con los parámetros actuales? (solo condiciones de primer nivel, sin '/')
function shownWith(prop, params, version) {
  if (!versionOk(prop, version)) return false;
  const d = prop.displayOptions;
  if (!d) return true;
  const val = (k) => params[k];
  for (const [k, allowed] of Object.entries(d.show || {})) {
    if (k === '@version' || k.startsWith('/')) continue;
    const v = val(k);
    if (!allowed.some((c) => cnd(c, v))) return false;
  }
  for (const [k, banned] of Object.entries(d.hide || {})) {
    if (k === '@version' || k.startsWith('/')) continue;
    const v = val(k);
    if (v !== undefined && banned.some((c) => cnd(c, v))) return false;
  }
  return true;
}

const isExpr = (v) => typeof v === 'string' && v.startsWith('=');

function checkValue(prop, value, where, errs, version) {
  if (value === undefined) return;
  if ((prop.type === 'options') && !isExpr(value)) {
    const allowed = (prop.options || []).map((o) => o.value);
    if (allowed.length && !allowed.includes(value)) errs.push(`${where}: valor "${value}" no está entre ${JSON.stringify(allowed)}`);
  }
  if (prop.type === 'boolean' && typeof value !== 'boolean' && !isExpr(value)) errs.push(`${where}: debería ser booleano`);
  if (prop.type === 'number' && typeof value !== 'number' && !isExpr(value)) errs.push(`${where}: debería ser número`);
  if (prop.type === 'collection') {
    if (typeof value !== 'object' || Array.isArray(value)) { errs.push(`${where}: collection debe ser objeto`); return; }
    for (const [k, v] of Object.entries(value)) {
      const cands = (prop.options || []).filter((o) => o.name === k && versionOk(o, version));
      if (!cands.length) { errs.push(`${where}.${k}: opción desconocida`); continue; }
      checkValue(cands[0], v, `${where}.${k}`, errs, version);
    }
  }
  if (prop.type === 'fixedCollection') {
    if (typeof value !== 'object' || Array.isArray(value)) { errs.push(`${where}: fixedCollection debe ser objeto`); return; }
    for (const [group, gv] of Object.entries(value)) {
      const g = (prop.options || []).find((o) => o.name === group);
      if (!g) { errs.push(`${where}.${group}: grupo desconocido`); continue; }
      const rows = Array.isArray(gv) ? gv : [gv];
      rows.forEach((row, i) => {
        for (const [k, v] of Object.entries(row)) {
          const cands = (g.values || []).filter((o) => o.name === k && versionOk(o, version));
          if (!cands.length) { errs.push(`${where}.${group}[${i}].${k}: campo desconocido`); continue; }
          checkValue(cands[0], v, `${where}.${group}[${i}].${k}`, errs, version);
        }
      });
    }
  }
}

function validateFile(file) {
  const errs = [];
  const warn = [];
  const wf = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!wf.name) errs.push('falta name');
  if (!Array.isArray(wf.nodes)) { errs.push('falta nodes'); return { errs, warn, wf }; }
  const names = new Set();
  const ids = new Set();
  const byName = {};
  for (const n of wf.nodes) {
    if (names.has(n.name)) errs.push(`nombre repetido: ${n.name}`);
    if (ids.has(n.id)) errs.push(`id repetido: ${n.id}`);
    names.add(n.name); ids.add(n.id); byName[n.name] = n;
    if (!Array.isArray(n.position) || n.position.length !== 2) errs.push(`${n.name}: position inválida`);
    // ajustes de bloque: qué hacer si falla y cuántas veces reintentar (el motor de n8n admite de 2 a 5 intentos y hasta 5 s de espera)
    if (n.onError !== undefined && !['continueRegularOutput', 'continueErrorOutput', 'stopWorkflow'].includes(n.onError)) errs.push(`${n.name}: onError desconocido "${n.onError}"`);
    if (n.retryOnFail && !(n.maxTries >= 2 && n.maxTries <= 5)) errs.push(`${n.name}: maxTries fuera de 2–5`);
    if (n.retryOnFail && !(n.waitBetweenTries >= 0 && n.waitBetweenTries <= 5000)) errs.push(`${n.name}: waitBetweenTries fuera de 0–5000`);
    if (n.type === 'n8n-nodes-base.gmail' && n.parameters?.operation === 'send' && n.retryOnFail) errs.push(`${n.name}: un envío de correo no debe reintentarse (podría salir dos veces)`);
    const cands = defs.filter((d) => d.full === n.type);
    if (!cands.length) { errs.push(`${n.name}: tipo desconocido ${n.type}`); continue; }
    const def = cands.find((d) => versionsOf(d).includes(n.typeVersion));
    if (!def) { errs.push(`${n.name}: typeVersion ${n.typeVersion} no existe para ${n.type}`); continue; }
    n.__def = def;
    // parámetros efectivos: lo que trae el archivo + valores por defecto de lo que se muestra
    const eff = {};
    for (const p of def.properties) {
      if (p.name in eff) continue;
      if (!shownWith(p, eff, n.typeVersion)) continue;
      eff[p.name] = n.parameters && p.name in n.parameters ? n.parameters[p.name] : p.default;
    }
    for (const [k, v] of Object.entries(n.parameters || {})) {
      const props = def.properties.filter((p) => p.name === k && versionOk(p, n.typeVersion));
      if (!props.length) { errs.push(`${n.name}: parámetro desconocido "${k}"`); continue; }
      const shown = props.filter((p) => shownWith(p, eff, n.typeVersion));
      if (!shown.length) { warn.push(`${n.name}: "${k}" no se muestra con estos parámetros`); }
      checkValue(shown[0] || props[0], v, `${n.name}.${k}`, errs, n.typeVersion);
    }
  }
  // conexiones
  const okTypes = new Set(['main', 'ai_languageModel', 'ai_outputParser']);
  let nConn = 0;
  for (const [src, byType] of Object.entries(wf.connections || {})) {
    if (!byName[src]) { errs.push(`conexión desde nodo inexistente: ${src}`); continue; }
    for (const [type, outs] of Object.entries(byType)) {
      if (!okTypes.has(type)) errs.push(`${src}: tipo de conexión raro ${type}`);
      const outDef = byName[src].__def && byName[src].__def.outputs;
      if (Array.isArray(outDef)) {
        const outTypes = outDef.map((o) => (typeof o === 'string' ? o : o.type));
        if (!outTypes.includes(type)) errs.push(`${src}: no tiene salida de tipo ${type} (tiene ${JSON.stringify(outTypes)})`);
      }
      for (const out of outs) for (const c of out) {
        nConn++;
        if (!byName[c.node]) errs.push(`${src} → nodo inexistente ${c.node}`);
        if (c.type !== type) errs.push(`${src} → ${c.node}: tipo distinto en destino`);
      }
    }
  }
  // referencias $('Nombre') en expresiones
  const txt = JSON.stringify(wf.nodes.map((n) => n.parameters));
  for (const m of txt.matchAll(/\$\('([^']+)'\)/g)) {
    if (!byName[m[1]]) errs.push(`expresión referencia un nodo inexistente: ${m[1]}`);
  }
  return { errs, warn, wf, nConn };
}

let bad = 0;
const files = process.argv.slice(2);
const parsed = {};
for (const f of files) {
  const { errs, warn, wf, nConn } = validateFile(f);
  parsed[path.basename(f)] = wf;
  const real = wf.nodes.filter((n) => n.type !== 'n8n-nodes-base.stickyNote').length;
  console.log(`${errs.length ? 'ERROR' : 'OK   '} ${path.basename(f)} — ${real} bloques, ${wf.nodes.length - real} notas, ${nConn} uniones`);
  errs.forEach((e) => console.log('   ✗', e));
  warn.forEach((e) => console.log('   !', e));
  bad += errs.length;
}
// coherencia terminado / para montar
const strip = (wf) => wf.nodes.filter((n) => n.type !== 'n8n-nodes-base.stickyNote').map((n) => ({ name: n.name, type: n.type, typeVersion: n.typeVersion, position: n.position, parameters: n.parameters, alwaysOutputData: n.alwaysOutputData, retryOnFail: n.retryOnFail, maxTries: n.maxTries, waitBetweenTries: n.waitBetweenTries, onError: n.onError }));
for (const name of Object.keys(parsed)) {
  if (!name.endsWith('-terminado.json')) continue;
  const noIds = (k, val) => (k === 'id' ? undefined : val);
  // «para montar» y «ensayo» tienen que llevar exactamente los mismos bloques y ajustes que el terminado
  for (const [other, sinUniones] of [[name.replace('-terminado.json', '-para-montar.json'), true], [name.replace('-terminado.json', '-ensayo.json'), false]]) {
    if (!parsed[other]) continue;
    const same = JSON.stringify(strip(parsed[name]), noIds) === JSON.stringify(strip(parsed[other]), noIds);
    const ajustes = JSON.stringify(parsed[name].settings) === JSON.stringify(parsed[other].settings);
    const uniones = sinUniones ? Object.keys(parsed[other].connections).length === 0 : JSON.stringify(parsed[other].connections) === JSON.stringify(parsed[name].connections);
    const bien = same && ajustes && uniones;
    console.log(`${bien ? 'OK   ' : 'ERROR'} ${other}: mismos bloques que el terminado=${same}, mismos ajustes=${ajustes}, ${sinUniones ? 'sin uniones' : 'mismas uniones'}=${uniones}`);
    if (!bien) bad++;
  }
}
// ningún archivo que se entrega lleva credenciales ni identificador propio
for (const [name, wf] of Object.entries(parsed)) {
  const conCred = wf.nodes.filter((n) => n.credentials).map((n) => n.name);
  if (conCred.length || wf.id) { console.log(`ERROR ${name}: ${conCred.length ? 'lleva credenciales en ' + conCred.join(', ') : ''}${wf.id ? ' lleva id' : ''}`); bad++; }
}
process.exit(bad ? 1 : 0);
