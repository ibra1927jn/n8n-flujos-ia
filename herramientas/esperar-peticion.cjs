// Espera a que el agente de n8n deje una petición en el buzón y la enseña, para que Claude la conteste.
// Uso: node esperar-peticion.cjs [segundos-de-espera] [sin-sistema]
const fs = require('fs');
const path = require('path');
const BUZON = path.join(__dirname, 'pruebas', 'buzon');
const max = Number(process.argv[2] || 120) * 1000;
const sinSistema = process.argv[3] === 'sin-sistema';
const pendiente = () => fs.readdirSync(BUZON).filter((f) => /^peticion-.*\.json$/.test(f) && !fs.existsSync(path.join(BUZON, f.replace('peticion-', 'respuesta-')))).sort()[0];
(async () => {
  const t0 = Date.now();
  let f;
  while (!(f = pendiente()) && Date.now() - t0 < max) await new Promise((r) => setTimeout(r, 300));
  if (!f) { console.log('no ha llegado ninguna petición en ' + max / 1000 + ' s'); process.exit(2); }
  await new Promise((r) => setTimeout(r, 200));
  const p = JSON.parse(fs.readFileSync(path.join(BUZON, f), 'utf8'));
  console.log(`PETICIÓN ${p.id} · flujo ${p.flujo} · formato de salida: ${p.formato || 'texto libre'} · ajustes que envía n8n: ${JSON.stringify(p.generacion)}`);
  console.log(`ARCHIVO DE RESPUESTA: ${path.join(BUZON, 'respuesta-' + p.id + '.json')}`);
  if (p.esquema) console.log('ESQUEMA: ' + JSON.stringify(p.esquema).slice(0, 900));
  if (!sinSistema) console.log('\n── MENSAJE DE SISTEMA ──\n' + p.sistema);
  console.log('\n── MENSAJE DEL USUARIO ──\n' + p.usuario);
})();
