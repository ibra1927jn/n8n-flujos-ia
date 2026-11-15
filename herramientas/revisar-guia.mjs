// Fotografía la guía (servida en local) para revisarla: entera y por tramos legibles.
import path from 'node:path';
import { SP, abrirNavegador, cerrarNavegador, pestana, sleep } from './cdp.mjs';
const OUT = path.join(SP, 'capturas2');
try {
  await abrirNavegador();
  const g = await pestana(1100, 900, 1, OUT);
  await g.frente();
  await g.ir('http://localhost:8123/guia.html');
  await g.esperar(`document.images.length >= 5 && [...document.images].every((i) => i.complete && i.naturalWidth > 0)`, 30000, 'que carguen las imágenes de la guía');
  await sleep(500);
  const info = await g.js(`({ alto: document.documentElement.scrollHeight, imagenes: [...document.images].map((i) => i.getAttribute('src') + ' ' + i.naturalWidth + 'x' + i.naturalHeight + ' → se ve a ' + Math.round(i.getBoundingClientRect().width) + ' px'), secciones: [...document.querySelectorAll('section.bloque')].map((s) => s.id + ' @' + Math.round(s.getBoundingClientRect().top + scrollY)), desborda: document.documentElement.scrollWidth > innerWidth })`);
  console.log(JSON.stringify(info, null, 1));
  // tramos de 1400 px para poder leerlos
  const tramos = [['guia-1-inicio.png', 0], ['guia-2-ensayo.png', null], ['guia-3-directo.png', null], ['guia-4-protegidos.png', null], ['guia-5-fallos.png', null], ['guia-6-preparacion.png', null]];
  const y2 = await g.js(`Math.round([...document.querySelectorAll('h3')].find((h) => /Ensayar sin credenciales/.test(h.textContent)).getBoundingClientRect().top + scrollY - 20)`);
  const yDe = (id) => g.js(`Math.round(document.getElementById('${id}').getBoundingClientRect().top + scrollY - 10)`);
  tramos[1][1] = y2; tramos[2][1] = await yDe('directo'); tramos[3][1] = await yDe('protegidos'); tramos[4][1] = await yDe('fallos'); tramos[5][1] = await yDe('preparacion');
  for (const [nombre, y] of tramos) {
    const { data } = await g.s('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width: 1100, height: 1500, scale: 1 } });
    (await import('node:fs')).writeFileSync(path.join(OUT, nombre), Buffer.from(data, 'base64'));
    console.log('    captura →', nombre);
  }
} catch (e) { console.log('✗', e.message); } finally { await cerrarNavegador(); }
