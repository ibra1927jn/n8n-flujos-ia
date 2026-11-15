// Capturas reales del editor para la guía: las tres versiones «para montar», tal como se ven al abrirlas.
// Uso: node capturas-guia.mjs <carpeta-proyecto>
import path from 'node:path';
import { abrirNavegador, cerrarNavegador, pestana, entrar, abrir, idDe, sleep } from './cdp.mjs';

const IMG = path.join(path.resolve(process.argv[2]), 'img');
const FLUJOS = [['1', 'Recepcionista IA (para montar'], ['2', 'Redactor de posts (para montar'], ['3', 'Resumen de varios Gmail (para montar']];
let mal = 0;
try {
  await abrirNavegador();
  const n = await pestana(1500, 860, 1.5, IMG);
  await entrar(n);
  for (const [k, nombre] of FLUJOS) {
    try {
      await abrir(n, idDe(nombre));
      const uniones = await n.js(`document.querySelectorAll('.vue-flow__edge').length`);
      if (uniones !== 0) throw new Error(`la copia «para montar» tiene ${uniones} uniones: no sirve para la captura`);
      await sleep(600);
      // solo el lienzo: sin la barra lateral ni la cabecera
      await n.foto(`${k}-para-montar.png`, { recorte: { x: 53, y: 86, width: 1447, height: 728 } });
    } catch (e) { mal++; console.log(`✗ flujo ${k}: ${e.message}`); }
  }
  // la guía entera, para revisarla
  const g = await pestana(1100, 900, 1, path.join(path.dirname(IMG), '..', '_revision'));
  await g.frente();
  await g.ir('http://localhost:8123/guia.html');
  await g.esperar(`document.images.length >= 5 && [...document.images].every((i) => i.complete && i.naturalWidth > 0)`, 30000, 'que carguen las imágenes de la guía');
  await g.js(`(document.querySelectorAll('img[loading]').forEach((i) => i.removeAttribute('loading')), 1)`);
  await sleep(800);
  await g.foto('guia-completa.png', { completa: true });
} catch (e) { mal++; console.log('✗', e.message); } finally { await cerrarNavegador(); console.log(mal ? `con problemas: ${mal}` : 'capturas de la guía hechas'); process.exit(mal ? 1 : 0); }
