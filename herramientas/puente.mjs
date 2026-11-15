// Ejecuta la copia «Claude en lugar de Gemini» de un flujo en el n8n de pruebas y guarda lo que devuelve.
// La respuesta de la IA no la da este programa: el agente de n8n deja su petición en pruebas/buzon y espera a que
// Claude, desde la sesión, escriba la respuesta. Uso: node puente.mjs <1|2|3> <archivo-con-los-datos.json>
import fs from 'node:fs';
import path from 'node:path';
import { SP, N8N, sleep, abrirNavegador, cerrarNavegador, pestana, entrar, abrir, encajar, ejecutar, aLaEscucha, idDe, ultimaEjecucion } from './cdp.mjs';

const k = process.argv[2];
const datos = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const RUTA = { 1: 'recepcionista', 2: 'redactor-posts', 3: 'puente-3-resumen-varios-gmail' }[k];
const NOMBRE = { 1: 'Recepcionista IA (Claude en lugar', 2: 'Redactor de posts (Claude en lugar', 3: 'Resumen de varios Gmail (Claude en lugar' }[k];
const salida = path.join(SP, 'pruebas', 'buzon', `resultado-${k}.json`);
try { fs.unlinkSync(salida); } catch {}
let res = { ok: false };
try {
  await abrirNavegador();
  const n = await pestana(1600, 900, 1.5, path.join(SP, 'capturas3'));
  await entrar(n);
  const id = idDe(NOMBRE);
  await abrir(n, id, 5);
  await n.frente(); await ejecutar(n); await aLaEscucha(n); await sleep(700);
  const t0 = Date.now();
  const r = await fetch(`${N8N}/webhook-test/${RUTA}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(datos) });
  const texto = await r.text();
  let json = null; try { json = JSON.parse(texto); } catch {}
  await n.frente(); await n.esperar(`!document.title.startsWith('🔄')`, 30000).catch(() => {});
  await sleep(1500); await encajar(n); await n.foto(`puente-${k}-lienzo.png`);
  const e = await ultimaEjecucion(id);
  res = { ok: r.status === 200, estado: r.status, segundos: Math.round((Date.now() - t0) / 100) / 10, json, texto: json ? undefined : texto.slice(0, 600), ejecucion: e?.status, errorEjecucion: e?.error, bloques: Object.fromEntries(Object.entries(e?.salida || {}).map(([nombre, v]) => [nombre, v.error ? 'ERROR: ' + v.error : v.items.length + ' elementos'])) };
} catch (e) { res = { ok: false, error: e.message }; } finally {
  fs.writeFileSync(salida, JSON.stringify(res, null, 2));
  console.log(`flujo ${k}: ${res.ok ? 'respuesta recibida en ' + res.segundos + ' s' : 'NO ha ido bien · ' + (res.error || res.estado + ' ' + (res.texto || ''))} · ejecución: ${res.ejecucion || '-'}`);
  await cerrarNavegador();
}
