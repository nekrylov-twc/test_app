import { useCallback, useEffect, useState } from 'react';
import { VERSION } from './version.js';
import { request, resolveApiUrl, saveApiUrl } from './api.js';

const BUILD = __BUILD_INFO__;
const WATCHED_HEADERS = ['x-robots-tag', 'cache-control', 'server'];

function KeyValue({ rows }) {
  return (
    <dl className="kv">
      {rows.map(([key, value]) => (
        <div key={key} className="kv-row">
          <dt>{key}</dt>
          <dd>{value ?? <span className="muted">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

function EnvTable({ env }) {
  const entries = Object.entries(env || {});
  if (!entries.length) return <p className="muted">Подходящих переменных нет.</p>;
  return <KeyValue rows={entries.map(([k, v]) => [k, <code>{v}</code>])} />;
}

function useApiBase() {
  const [api, setApi] = useState(resolveApiUrl);
  const update = (url) => {
    saveApiUrl(url);
    setApi(resolveApiUrl());
  };
  return [api, update];
}

function ApiSettings({ api, onChange }) {
  const [draft, setDraft] = useState(api.url);
  useEffect(() => setDraft(api.url), [api.url]);
  return (
    <section className="card">
      <h2>Адрес бэкенда</h2>
      <p>
        Сейчас: <code>{api.url || window.location.origin}</code>
        <span className="muted"> · источник: {api.source}</span>
      </p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          onChange(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://owner-repo-stand-xxxx.twc1.net"
        />
        <button type="submit">Применить</button>
        <button type="button" className="ghost" onClick={() => onChange('')}>
          Сбросить
        </button>
      </form>
      <p className="hint">
        Превью фронтенда по умолчанию ходит в бэкенд из VITE_API_URL, то есть, скорее всего, в прод. Чтобы связать его с
        превью бэкенда, откройте страницу с <code>?api=https://адрес-стенда-бэкенда</code>.
      </p>
    </section>
  );
}

function BackendCard({ info, error, latency, onRefresh }) {
  let badge = 'загрузка…';
  if (error) badge = 'недоступен';
  else if (info) badge = `ok · ${latency} мс`;
  return (
    <section className="card">
      <div className="card-head">
        <h2>Backend</h2>
        <span className={`badge ${error ? 'bad' : info ? 'good' : ''}`}>{badge}</span>
      </div>
      {error && <p className="error">{error}</p>}
      {info && (
        <>
          <KeyValue
            rows={[
              ['Метка сборки', <b>{info.label}</b>],
              ['Инстанс', <code>{info.instanceId}</code>],
              ['Запущен', new Date(info.startedAt).toLocaleString('ru-RU')],
              ['Аптайм', `${info.uptimeSec} с`],
              ['Запросов', info.requestCount],
              ['Node.js', info.node],
              ['Hostname', info.host],
              ['Host запроса', info.requestHost],
            ]}
          />
          <h3>Окружение бэкенда</h3>
          <EnvTable env={info.env} />
        </>
      )}
      <button className="ghost" onClick={onRefresh}>
        Обновить
      </button>
    </section>
  );
}

function FrontendCard() {
  return (
    <section className="card">
      <div className="card-head">
        <h2>Frontend</h2>
        <span className="badge good">{import.meta.env.MODE}</span>
      </div>
      <KeyValue
        rows={[
          ['Метка сборки', <b>{VERSION.label}</b>],
          ['Собран', new Date(BUILD.builtAt).toLocaleString('ru-RU')],
          ['Git-ветка при сборке', BUILD.gitBranch],
          ['Git-коммит при сборке', BUILD.gitCommit && <code>{BUILD.gitCommit.slice(0, 12)}</code>],
          ['Сообщение коммита', BUILD.gitCommitMessage],
          ['Открыт по адресу', window.location.host],
        ]}
      />
      <h3>Окружение сборки</h3>
      <EnvTable env={BUILD.env} />
    </section>
  );
}

function HeadersCard({ backendHeaders }) {
  const [own, setOwn] = useState(null);
  useEffect(() => {
    fetch(window.location.pathname, { method: 'HEAD', cache: 'no-store' })
      .then((r) => setOwn(r.headers))
      .catch(() => setOwn(null));
  }, []);
  const robotsMeta = document.querySelector('meta[name="robots"]')?.content;
  const pick = (headers) => WATCHED_HEADERS.map((h) => [h, headers?.get(h)]);
  return (
    <section className="card">
      <h2>Заголовки ответа</h2>
      <p className="hint">
        Превью не должно индексироваться: на стендах ждём <code>X-Robots-Tag: noindex</code>. Заголовки бэкенда браузер
        покажет, только если они перечислены в <code>Access-Control-Expose-Headers</code>.
      </p>
      <h3>Эта страница</h3>
      <KeyValue rows={[...pick(own), ['meta robots', robotsMeta]]} />
      <h3>Backend /api/info</h3>
      <KeyValue rows={pick(backendHeaders)} />
    </section>
  );
}

function Notes({ baseUrl }) {
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    request(baseUrl, '/api/notes')
      .then(({ body }) => {
        setNotes(body);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [baseUrl]);

  useEffect(load, [load]);

  async function add(e) {
    e.preventDefault();
    try {
      await request(baseUrl, '/api/notes', { method: 'POST', body: JSON.stringify({ text }) });
      setText('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    try {
      await request(baseUrl, `/api/notes/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="card">
      <h2>Заметки</h2>
      <p className="hint">
        Хранятся в памяти бэкенда. Добавьте заметку на превью и проверьте, что на проде её нет: так видно, что стенды не
        делят состояние.
      </p>
      <form className="row" onSubmit={add}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Текст заметки" maxLength={500} />
        <button type="submit" disabled={!text.trim()}>
          Добавить
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {notes.length === 0 ? (
        <p className="muted">Пока пусто.</p>
      ) : (
        <ul className="notes">
          {notes.map((n) => (
            <li key={n.id}>
              <span>{n.text}</span>
              <span className="muted">
                {new Date(n.createdAt).toLocaleTimeString('ru-RU')} · {n.instanceId}
              </span>
              <button className="ghost small" onClick={() => remove(n.id)} aria-label="Удалить">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const [api, setApi] = useApiBase();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [latency, setLatency] = useState(null);
  const [headers, setHeaders] = useState(null);

  const load = useCallback(() => {
    setError(null);
    request(api.url, '/api/info')
      .then(({ body, latencyMs, headers }) => {
        setInfo(body);
        setLatency(latencyMs);
        setHeaders(headers);
      })
      .catch((e) => {
        setInfo(null);
        setError(`${e.message}. Проверьте адрес бэкенда и CORS.`);
      });
  }, [api.url]);

  useEffect(load, [load]);

  const contractMismatch = info && info.apiContract !== VERSION.apiContract;
  const labelMismatch = info && info.label !== VERSION.label;

  return (
    <div style={{ '--accent': VERSION.accent }}>
      <header className="hero">
        <div className="wrap">
          <p className="eyebrow">App Platform · PR preview check</p>
          <h1>{VERSION.label}</h1>
          <p>
            Тестовое приложение: фронтенд и бэкенд из одного репозитория. Поменяйте метку в{' '}
            <code>frontend/src/version.js</code> и <code>backend/src/version.js</code> в pull request и сравните превью с
            продом.
          </p>
        </div>
      </header>
      <main className="wrap">
        {contractMismatch && (
          <div className="banner bad">
            Контракт API расходится: фронтенд ждёт v{VERSION.apiContract}, бэкенд отдаёт v{info.apiContract}.
          </div>
        )}
        {!contractMismatch && labelMismatch && (
          <div className="banner warn">
            Фронтенд «{VERSION.label}» общается с бэкендом «{info.label}». Возможно, превью фронтенда смотрит в
            прод-бэкенд.
          </div>
        )}
        <ApiSettings api={api} onChange={setApi} />
        <div className="grid">
          <FrontendCard />
          <BackendCard info={info} error={error} latency={latency} onRefresh={load} />
        </div>
        <Notes baseUrl={api.url} />
        <HeadersCard backendHeaders={headers} />
      </main>
      <footer className="wrap muted">github.com/nekrylov-twc/test_app</footer>
    </div>
  );
}
