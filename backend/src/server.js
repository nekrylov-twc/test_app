const crypto = require('crypto');
const os = require('os');
const express = require('express');
const cors = require('cors');
const version = require('./version');

const PORT = Number(process.env.PORT) || 3000;
const INSTANCE_ID = crypto.randomBytes(4).toString('hex');
const STARTED_AT = new Date();

// Переменные, которые могут рассказать, из какой ветки/коммита/PR собран стенд.
const INTERESTING_ENV = /(BRANCH|COMMIT|SHA|REF|PR_|PULL|PREVIEW|STAND|DEPLOY|TWC|TIMEWEB|APP_|GIT|BUILD|NODE_ENV|HOSTNAME)/i;
const SECRET_ENV = /(TOKEN|SECRET|PASSWORD|PASSWD|KEY|CREDENTIAL|AUTH)/i;

function collectEnv() {
  const result = {};
  for (const name of Object.keys(process.env).sort()) {
    if (!INTERESTING_ENV.test(name)) continue;
    result[name] = SECRET_ENV.test(name) ? '***скрыто***' : process.env[name];
  }
  return result;
}

const app = express();
// Expose-Headers нужен, чтобы фронтенд с другого домена увидел X-Robots-Tag, который ставит прокси стенда.
app.use(cors({ exposedHeaders: ['X-Robots-Tag', 'Server'] }));
app.use(express.json());

let requestCount = 0;
app.use((req, _res, next) => {
  requestCount += 1;
  next();
});

// Заметки в памяти: у каждого стенда своё состояние, по нему видно, что превью изолировано от прода.
let nextNoteId = 1;
const notes = [];

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<meta charset="utf-8">
<title>test_app backend</title>
<body style="font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px">
<h1>test_app backend</h1>
<p>Сборка: <b>${version.label}</b>, инстанс <code>${INSTANCE_ID}</code></p>
<ul>
  <li><a href="/api/health">/api/health</a></li>
  <li><a href="/api/info">/api/info</a></li>
  <li><a href="/api/notes">/api/notes</a></li>
</ul>
</body>`);
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', instanceId: INSTANCE_ID, time: new Date().toISOString() });
});

app.get('/api/info', (req, res) => {
  res.json({
    label: version.label,
    apiContract: version.apiContract,
    instanceId: INSTANCE_ID,
    startedAt: STARTED_AT.toISOString(),
    uptimeSec: Math.round(process.uptime()),
    requestCount,
    node: process.version,
    host: os.hostname(),
    requestHost: req.get('host'),
    env: collectEnv(),
  });
});

app.get('/api/notes', (_req, res) => {
  res.json(notes);
});

app.post('/api/notes', (req, res) => {
  const text = String(req.body?.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'Поле text обязательно' });
  if (text.length > 500) return res.status(400).json({ error: 'Не длиннее 500 символов' });
  const note = { id: nextNoteId++, text, createdAt: new Date().toISOString(), instanceId: INSTANCE_ID };
  notes.unshift(note);
  if (notes.length > 100) notes.pop();
  res.status(201).json(note);
});

app.delete('/api/notes/:id', (req, res) => {
  const index = notes.findIndex((n) => n.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Заметка не найдена' });
  notes.splice(index, 1);
  res.status(204).end();
});

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[test_app] backend "${version.label}" instance ${INSTANCE_ID} listening on :${PORT}`);
});
