// Utilidades compartidas: Edge sin ventana (perfil propio y temporal) manejado por el protocolo de depuración,
// más los pasos habituales en el editor de n8n de pruebas.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

export const SP = path.dirname(fileURLToPath(import.meta.url));
export const N8N = 'http://localhost:5679';
export const WEB = 'http://localhost:8123/web';
export const CONEXION = '?n8n=' + encodeURIComponent(N8N) + '&modo=prueba';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CDP = 9333;

export const acceso = Object.fromEntries(
  fs.readFileSync(path.join(SP, 'n8n-demo', 'ACCESO-DEMO.txt'), 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^(\S+):\s+(.+?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]),
);

export function bd(fn) {
  const db = new DatabaseSync(path.join(SP, 'n8n-demo', '.n8n', 'database.sqlite'), { readOnly: true });
  try { return fn(db); } finally { db.close(); }
}
export const flujos = () => bd((db) => db.prepare('SELECT id, name FROM workflow_entity ORDER BY name').all());
export const idDe = (trozo) => {
  const f = flujos().find((x) => x.name.includes(trozo));
  if (!f) throw new Error('no encuentro el flujo: ' + trozo);
  return f.id;
};

let ws; let seq = 0; let edge;
const pendientes = new Map();
const escuchas = new Map(); // método del evento → función que lo recibe una vez
export const evento = (metodo, ms = 15000) => new Promise((res, rej) => {
  const t = setTimeout(() => { escuchas.delete(metodo); rej(new Error('no ha llegado el evento ' + metodo)); }, ms);
  escuchas.set(metodo, (p) => { clearTimeout(t); res(p); });
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++seq;
  pendientes.set(id, { res, rej, method });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});

export async function abrirNavegador() {
  edge = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${path.join(SP, 'edge-perfil')}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
    '--disable-background-networking', '--disable-component-update', '--no-pings', '--hide-scrollbars',
    '--window-size=1600,900', 'about:blank',
  ], { stdio: 'ignore' });
  let url;
  for (let i = 0; i < 80 && !url; i++) {
    try { url = (await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json()).webSocketDebuggerUrl; } catch { await sleep(500); }
  }
  if (!url) throw new Error('Edge no ha abierto el puerto de depuración');
  ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('no conecta con Edge')); });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    // «¿Salir sin guardar?» y similares: se aceptan para que no bloqueen la prueba.
    if (m.method === 'Page.javascriptDialogOpening' && m.sessionId) send('Page.handleJavaScriptDialog', { accept: true }, m.sessionId).catch(() => {});
    if (m.method && escuchas.has(m.method)) { const f = escuchas.get(m.method); escuchas.delete(m.method); f(m.params); }
    if (m.id && pendientes.has(m.id)) {
      const p = pendientes.get(m.id);
      pendientes.delete(m.id);
      if (m.error) p.rej(new Error(`${p.method}: ${m.error.message}`)); else p.res(m.result);
    }
  };
}

export async function cerrarNavegador() {
  try { await send('Browser.close'); } catch {}
  await sleep(600);
  try { edge.kill(); } catch {}
  await sleep(400);
  try { fs.rmSync(path.join(SP, 'edge-perfil'), { recursive: true, force: true, maxRetries: 5, retryDelay: 400 }); } catch {}
}

export async function pestana(w = 1600, h = 900, escala = 1.5, carpeta = SP) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p = {}) => send(m, p, sessionId);
  await s('Page.enable');
  await s('Runtime.enable');
  await s('DOM.enable');
  await s('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: escala, mobile: false });
  await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  const t = {
    s,
    frente: () => s('Page.bringToFront'),
    ir: async (u) => { await s('Page.navigate', { url: u }); await sleep(400); },
    js: async (expression) => {
      const r = await s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    esperar: async (expression, ms = 40000, que = expression) => {
      const t0 = Date.now();
      for (;;) {
        try { const v = await t.js(expression); if (v) return v; } catch {}
        if (Date.now() - t0 > ms) throw new Error('tiempo agotado esperando: ' + que);
        await sleep(300);
      }
    },
    centro: async (expr) => {
      const p = await t.js(`(() => { const e = ${expr}; if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height }; })()`);
      if (!p) throw new Error('no encuentro: ' + expr);
      return p;
    },
    clic: async (expr) => {
      await t.js(`(() => { const e = ${expr}; if (e) e.scrollIntoView({ block: 'center', inline: 'center' }); })()`);
      const p = await t.centro(expr);
      await s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
      await s('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      await s('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      await sleep(150);
    },
    arrastrar: async (desde, hasta, pasos = 14) => {
      await s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: desde.x, y: desde.y });
      await sleep(80);
      await s('Input.dispatchMouseEvent', { type: 'mousePressed', x: desde.x, y: desde.y, button: 'left', buttons: 1, clickCount: 1 });
      await sleep(80);
      for (let i = 1; i <= pasos; i++) {
        const k = i / pasos;
        await s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: desde.x + (hasta.x - desde.x) * k, y: desde.y + (hasta.y - desde.y) * k, button: 'left', buttons: 1 });
        await sleep(25);
      }
      await sleep(150);
      await s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hasta.x, y: hasta.y, button: 'left', buttons: 1 });
      await sleep(120);
      await s('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hasta.x, y: hasta.y, button: 'left', buttons: 0, clickCount: 1 });
      await sleep(350);
    },
    escribir: (text) => s('Input.insertText', { text }),
    tecla: async (key, code = key, vk = 0, modifiers = 0) => {
      await s('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, modifiers });
      await s('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers });
    },
    archivos: async (selector, rutas) => {
      const { root } = await s('DOM.getDocument', { depth: 0 });
      const { nodeId } = await s('DOM.querySelector', { nodeId: root.nodeId, selector });
      if (!nodeId) throw new Error('no encuentro el selector de archivos: ' + selector);
      await s('DOM.setFileInputFiles', { nodeId, files: rutas });
    },
    foto: async (nombre, { completa = false, recorte = null } = {}) => {
      const params = { format: 'png' };
      if (recorte) params.clip = { ...recorte, scale: 1 };
      if (completa) {
        const alto = await t.js('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)');
        params.captureBeyondViewport = true;
        params.clip = { x: 0, y: 0, width: w, height: alto, scale: 1 };
      }
      const { data } = await s('Page.captureScreenshot', params);
      fs.mkdirSync(carpeta, { recursive: true });
      fs.writeFileSync(path.join(carpeta, nombre), Buffer.from(data, 'base64'));
      console.log('    captura →', nombre);
    },
  };
  return t;
}

// ── n8n ──
export const NODOS = `document.querySelectorAll('[data-test-id="canvas-node"]')`;
export const estadoNodos = `[...${NODOS}].filter((n) => !/stickyNote/.test(n.getAttribute('data-node-type') || '')).map((n) => n.getAttribute('data-node-name') + '=' + ([...n.querySelectorAll('[data-test-id^="canvas-node-status"]')].map((x) => x.getAttribute('data-test-id').replace('canvas-node-status-', '')).join('+') || (n.querySelector('[class*="pinned"]') ? 'fijado' : '-'))).join(' · ')`;
export const exito = (nombre) => `!!document.querySelector('[data-test-id="canvas-node"][data-node-name="${nombre}"] [data-test-id="canvas-node-status-success"]')`;
export const avisos = `[...document.querySelectorAll('.el-notification')].map((e) => e.textContent.trim().replace(/\\s+/g, ' ').slice(0, 220))`;

export async function entrar(n) {
  await n.ir(N8N + '/signin');
  await n.esperar(`!!document.querySelector('input[type=email]') || !!document.querySelector('[data-test-id="main-sidebar-settings"]')`, 90000, 'pantalla de inicio de sesión');
  if (await n.js(`!!document.querySelector('input[type=email]')`)) {
    await n.clic(`document.querySelector('input[type=email]')`);
    await n.escribir(acceso.Correo);
    await n.clic(`document.querySelector('input[type=password]')`);
    await n.escribir(acceso['Contraseña']);
    await n.clic(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Sign in')`);
    await n.esperar(`!location.pathname.startsWith('/signin')`, 40000, 'entrar en n8n');
  }
}

export async function encajar(n) {
  await n.clic(`document.querySelector('[data-test-id="zoom-to-fit"]')`);
  await sleep(900);
  await n.s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 800, y: 60 });
  await sleep(300);
}

export async function abrir(n, id, minimo = 5) {
  await n.frente(); // en segundo plano el navegador ralentiza la pestaña y n8n pierde la conexión
  await n.ir(`${N8N}/workflow/${id}`);
  await n.esperar(`${NODOS}.length > ${minimo}`, 90000, 'que se pinte el lienzo');
  await sleep(1500);
  await n.tecla('Escape', 'Escape', 27);
  await tomarEdicion(n);
  await encajar(n);
}

// Si n8n cree que el flujo se está editando en otra pestaña, lo deja en solo lectura con un botón «Edit here».
export async function tomarEdicion(n) {
  const boton = `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Edit here')`;
  // el aviso puede tardar unos segundos en aparecer después de cargar el flujo
  for (let i = 0; i < 12 && !(await n.js(`!!(${boton})`)); i++) await sleep(500);
  if (await n.js(`!!(${boton})`)) {
    await n.clic(boton);
    await n.esperar(`!(${boton})`, 15000, 'recuperar la edición del flujo').catch(() => {});
    await sleep(800);
    return true;
  }
  return false;
}

export const ejecutar = (n) => n.clic(`document.querySelector('[data-test-id="execute-workflow-button"]')`);
export const aLaEscucha = (n) => n.esperar(`document.title.startsWith('🔄')`, 20000, 'que n8n quede a la escucha');

// Última ejecución guardada de un flujo: salida de cada bloque.
export async function ultimaEjecucion(workflowId) {
  const { parse } = await import('file:///' + path.join(process.env.APPDATA, 'npm', 'node_modules', 'n8n', 'node_modules', 'flatted', 'esm', 'index.js').replace(/\\/g, '/'));
  return bd((db) => {
    const e = db.prepare('SELECT id, status, mode FROM execution_entity WHERE workflowId = ? ORDER BY id DESC LIMIT 1').get(workflowId);
    if (!e) return null;
    const d = db.prepare('SELECT data FROM execution_data WHERE executionId = ?').get(e.id);
    const datos = parse(d.data);
    const run = datos.resultData.runData || {};
    const salida = {};
    for (const [nombre, v] of Object.entries(run)) salida[nombre] = { intentos: v.length, error: v[v.length - 1].error?.message, items: (v[v.length - 1].data?.main?.[0] || []).map((i) => i.json) };
    return { id: e.id, status: e.status, mode: e.mode, salida, error: datos.resultData.error?.message };
  });
}
