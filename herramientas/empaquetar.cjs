// Crea proyecto-n8n.zip a partir de la carpeta del proyecto y comprueba que lo que hay dentro es idéntico a la carpeta.
// Uso: node empaquetar.cjs <carpeta-de-la-sesion>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const base = path.resolve(process.argv[2]);
const zip = path.join(base, 'proyecto-n8n.zip');
const tar = path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe');
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const lista = (dir, rel = '') => fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? lista(dir, path.join(rel, e.name)) : [path.join(rel, e.name).replace(/\\/g, '/')])).sort();

// nada que no deba ir: ni credenciales ni identificadores en los flujos
const flujos = lista(path.join(base, 'proyecto-n8n')).filter((f) => f.endsWith('.json'));
for (const f of flujos) {
  const w = JSON.parse(fs.readFileSync(path.join(base, 'proyecto-n8n', f), 'utf8'));
  if (w.id || w.nodes.some((n) => n.credentials)) throw new Error('el flujo lleva id o credenciales: ' + f);
}

const anterior = fs.existsSync(zip) ? `${fs.statSync(zip).size} bytes` : 'no había';
if (fs.existsSync(zip)) fs.unlinkSync(zip);
execFileSync(tar, ['-a', '-c', '-f', zip, 'proyecto-n8n'], { cwd: base });

const tmp = fs.mkdtempSync(path.join(__dirname, 'zip-comprobado-'));
execFileSync(tar, ['-x', '-f', zip, '-C', tmp]);
const enCarpeta = lista(path.join(base, 'proyecto-n8n'));
const enZip = lista(path.join(tmp, 'proyecto-n8n'));
const distintos = enCarpeta.filter((f) => !enZip.includes(f) || hash(path.join(base, 'proyecto-n8n', f)) !== hash(path.join(tmp, 'proyecto-n8n', f)));
const sobran = enZip.filter((f) => !enCarpeta.includes(f));
console.log(`zip anterior: ${anterior} · zip nuevo: ${fs.statSync(zip).size} bytes`);
console.log(`archivos en la carpeta: ${enCarpeta.length} · en el zip: ${enZip.length} · distintos: ${distintos.length} · sobran: ${sobran.length}`);
for (const f of enCarpeta) console.log('  ' + f);
fs.rmSync(tmp, { recursive: true, force: true });
if (distintos.length || sobran.length) { console.log('NO COINCIDE: ' + distintos.concat(sobran).join(', ')); process.exit(1); }
console.log('el zip es idéntico a la carpeta');
