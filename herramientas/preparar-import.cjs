// Prepara las copias que se importan en la instancia de pruebas (con id, para actualizar sin duplicar).
// Uso: node preparar-import.cjs <carpeta-proyecto>
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const SP = __dirname;
const PROY = process.argv[2];
const db = new DatabaseSync(path.join(SP, 'n8n-demo', '.n8n', 'database.sqlite'), { readOnly: true });
const ids = Object.fromEntries(db.prepare('SELECT id, name FROM workflow_entity').all().map((r) => [r.name, r.id]));
db.close();
const out = path.join(SP, 'pruebas', 'actualizar');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const pon = (file, w) => { fs.writeFileSync(path.join(out, file), JSON.stringify(w, null, 2)); console.log(`${w.id}  ${w.name}`); };
const lee = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const jsons = (d) => fs.readdirSync(d).filter((x) => x.endsWith('.json')).sort();

// 1) entregables: se actualizan por nombre
for (const f of jsons(path.join(PROY, 'flujos'))) {
  const w = lee(path.join(PROY, 'flujos', f));
  if (!ids[w.name]) throw new Error('entregable sin copia en la instancia: ' + w.name);
  pon(f, { ...w, id: ids[w.name], active: false });
}
// 2) ensayo sin conexión: ocupan el sitio de las antiguas «demo simulada»
jsons(path.join(PROY, 'flujos', 'ensayo-sin-conexion')).forEach((f, i) => pon(f, { ...lee(path.join(PROY, 'flujos', 'ensayo-sin-conexion', f)), id: 'demo' + String(i + 1).padStart(12, '0'), active: false }));
// 3) pruebas internas: IA simulada y simulacros (ya llevan id)
for (const d of ['mock', 'simulacros']) for (const f of jsons(path.join(SP, 'pruebas', d))) pon(f, lee(path.join(SP, 'pruebas', d, f)));
