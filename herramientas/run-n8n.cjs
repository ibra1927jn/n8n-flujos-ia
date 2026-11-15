// Arranca una copia de n8n aislada para la demo en pantalla.
// Usa su propia carpeta de datos (n8n-demo), otro puerto y solo escucha en este ordenador.
// No toca la carpeta de datos habitual de n8n (~/.n8n).
const path = require('path');

Object.assign(process.env, {
  N8N_USER_FOLDER: path.join(__dirname, 'n8n-demo'),
  N8N_PORT: '5679',
  N8N_LISTEN_ADDRESS: '127.0.0.1',
  // El gestor interno de tareas de n8n usa por defecto el 5679: se mueve para que no choque.
  N8N_RUNNERS_BROKER_PORT: '5681',
  N8N_SECURE_COOKIE: 'false',
  // Nada de datos hacia fuera: sin telemetría, avisos de versión, plantillas ni encuestas.
  N8N_DIAGNOSTICS_ENABLED: 'false',
  N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
  N8N_TEMPLATES_ENABLED: 'false',
  N8N_PERSONALIZATION_ENABLED: 'false',
  N8N_HIRING_BANNER_ENABLED: 'false',
  GENERIC_TIMEZONE: 'Europe/Madrid',
});

const bin = path.join(process.env.APPDATA, 'npm', 'node_modules', 'n8n', 'bin', 'n8n');
const args = process.argv.slice(2);
process.argv = [process.argv[0], bin, ...(args.length ? args : ['start'])];
require(bin);
