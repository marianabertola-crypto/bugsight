import { useEffect, useMemo, useState } from 'react';
import { useBugs } from '../context/BugsContext';
import { MODULES, PRIORITIES } from '../config/modules';
import './ReportBug.css';

const EMPTY_FORM = {
  title: '',
  description: '',
  module: '',
  priority: '',
  affectedClients: '',
  resourceId: '',
};

function computeScore(form) {
  let score = 0;
  const feedback = [];

  if (form.title.trim().length >= 20) {
    score += 20;
  } else {
    feedback.push(
      form.title.trim().length === 0
        ? 'Agregá un título descriptivo del problema'
        : 'Extendé el título a 20+ caracteres para que sea más claro'
    );
  }

  const desc = form.description.trim();
  const hasSteps = /pasos para reproducir|reproducir|steps to/i.test(desc);
  if (desc.length >= 80 && hasSteps) {
    score += 30;
  } else if (desc.length >= 80) {
    score += 15;
    feedback.push('Falta describir los pasos para reproducir el bug');
  } else {
    feedback.push('Escribí una descripción más detallada (80+ caracteres) con pasos para reproducir');
  }

  if (form.module) score += 15;
  else feedback.push('Elegí el módulo afectado');

  if (form.priority) score += 10;
  else feedback.push('Seleccioná la prioridad');

  if (form.affectedClients.trim().length > 0) score += 10;
  else feedback.push('Indicá al menos un cliente afectado');

  if (form.resourceId.trim().length > 0) score += 15;
  else feedback.push('Agregá el ID del recurso afectado (post, chat, goal, etc.)');

  return { score, feedback };
}

function generateAutoNote(form) {
  // TODO(API) — NOT EXECUTED IN THIS VERSION.
  // This version purposefully does NOT read from Jira. The text below is mocked.
  // When wiring the real integration, replace with GET /rest/api/3/search using JQL like
  // `project = HUM AND module = "${form.module}" AND status = Resuelto ORDER BY resolved DESC`
  // to pull real past resolutions from Jira for the selected module.
  return `Contexto automático para el dev:
• Bugs previos en el módulo "${form.module || '—'}" se resolvieron en promedio en 3.5 días.
• Última resolución: ajuste en el servicio de caché del módulo.
• Recomendación: revisar logs del servicio durante las últimas 24h antes de iterar.`;
}

export default function ReportBug({ onSaved }) {
  const { addBug } = useBugs();
  const [form, setForm] = useState(EMPTY_FORM);
  const [aiSearching, setAiSearching] = useState(false);
  const [similar, setSimilar] = useState([]);
  const [createdId, setCreatedId] = useState(null);

  const { score, feedback } = useMemo(() => computeScore(form), [form]);

  useEffect(() => {
    const title = form.title.trim();
    if (title.length < 8) {
      setAiSearching(false);
      setSimilar([]);
      return undefined;
    }

    setAiSearching(true);
    setSimilar([]);

    // TODO(API) — NOT EXECUTED IN THIS VERSION.
    // This version does NOT call any AI service. The results below are mocked
    // just to exercise the UX. When wiring the real integration:
    //   POST the current title to a semantic search endpoint
    //   (embeddings + vector DB) and replace the mocked results with the
    //   real matches returned by the model.
    const timeout = setTimeout(() => {
      setAiSearching(false);
      setSimilar([
        { id: 'HUM-0921', title: 'Feed lento al cargar comentarios', similarity: 84 },
        { id: 'HUM-0875', title: 'Respuestas anidadas no aparecen en mobile', similarity: 71 },
        { id: 'HUM-0812', title: 'Errores de render en hilos largos del Feed', similarity: 66 },
      ]);
    }, 1500);

    return () => clearTimeout(timeout);
  }, [form.title]);

  function update(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function handleSubmit(e) {
    e.preventDefault();

    const id = `HUM-${Math.floor(1000 + Math.random() * 9000)}`;
    const autoNote = generateAutoNote(form);

    const newBug = {
      id,
      title: form.title.trim(),
      description: form.description.trim(),
      module: form.module,
      priority: form.priority,
      status: 'Backlog',
      reportedAt: new Date().toISOString(),
      resolvedAt: null,
      eta: null,
      affectedClients: form.affectedClients
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      resourceId: form.resourceId.trim(),
      etaRequests: [],
      notes: [
        {
          author: 'BugSight (auto)',
          text: autoNote,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    // TODO(API) — NOT EXECUTED IN THIS VERSION.
    // This version does NOT write to Jira: the bug is stored only in local state
    // and the ID above is generated client-side on purpose.
    // When wiring the real integration:
    //   POST /rest/api/3/issue to Jira using a Personal Access Token
    //   Payload example:
    //     { fields: { project: { key: 'HUM' }, summary: form.title,
    //       description: form.description, issuetype: { name: 'Bug' },
    //       priority: { name: form.priority }, customfield_module: form.module,
    //       customfield_affected_clients: [...] } }
    //   Use the returned issue key instead of the locally generated `id`.
    addBug(newBug);
    setCreatedId(id);

    setTimeout(() => {
      setForm(EMPTY_FORM);
      setCreatedId(null);
      onSaved?.();
    }, 2200);
  }

  const canSubmit = form.title && form.module && form.priority;

  return (
    <div className="report-wrapper">
      <form className="report-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="title">Título</label>
          <input
            id="title"
            className="input"
            placeholder="Ej: Feed no carga comentarios en posts con más de 50 respuestas"
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
          />
          {aiSearching && (
            <div className="ai-banner ai-banner-loading">
              <span className="spinner" /> Buscando bugs similares con IA…
            </div>
          )}
          {!aiSearching && similar.length > 0 && (
            <div className="ai-banner ai-banner-results">
              <span className="ai-banner-title">Encontramos bugs similares</span>
              <ul>
                {similar.map((s) => (
                  <li key={s.id}>
                    <strong>{s.id}</strong> — {s.title}
                    <span className="similarity">{s.similarity}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="field">
          <label htmlFor="description">Descripción</label>
          <textarea
            id="description"
            className="input"
            rows={6}
            placeholder="Incluí los pasos para reproducir, el resultado esperado y el resultado actual."
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="module">Módulo</label>
            <select
              id="module"
              className="input"
              value={form.module}
              onChange={(e) => update({ module: e.target.value })}
            >
              <option value="">Seleccioná un módulo…</option>
              {MODULES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="priority">Prioridad</label>
            <select
              id="priority"
              className="input"
              value={form.priority}
              onChange={(e) => update({ priority: e.target.value })}
            >
              <option value="">Seleccioná prioridad…</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="clients">Cliente/s afectado/s</label>
            <input
              id="clients"
              className="input"
              placeholder="Separalos por coma. Ej: Banco Norte, RetailCorp"
              value={form.affectedClients}
              onChange={(e) => update({ affectedClients: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="resource">ID del recurso afectado</label>
            <input
              id="resource"
              className="input"
              placeholder="Ej: post_8821, chat_group_330"
              value={form.resourceId}
              onChange={(e) => update({ resourceId: e.target.value })}
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!canSubmit || createdId !== null}
          >
            {createdId ? `Creado: ${createdId} ✓` : 'Crear en Jira'}
          </button>
        </div>

        {createdId && (
          <div className="success-banner">
            Bug creado con ID <strong>{createdId}</strong>. Redirigiendo al Bug Tracker…
          </div>
        )}
      </form>

      <aside className="report-side">
        <div className="score-card">
          <div className="score-head">
            <span>Calidad de la card</span>
            <strong>{score}%</strong>
          </div>
          <div className="score-bar">
            <div
              className="score-bar-fill"
              style={{
                width: `${score}%`,
                background:
                  score >= 80
                    ? 'var(--color-success)'
                    : score >= 50
                    ? 'var(--color-warning)'
                    : 'var(--color-danger)',
              }}
            />
          </div>
          {feedback.length > 0 ? (
            <ul className="score-feedback">
              {feedback.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : (
            <p className="score-feedback-empty">Todo listo para crear una card de alta calidad.</p>
          )}
        </div>

        <div className="auto-note">
          <h3>Nota interna automática</h3>
          <p className="auto-note-hint">
            Se adjuntará al crear la card. Usa contexto de bugs previos similares.
          </p>
          <pre>{generateAutoNote(form)}</pre>
        </div>
      </aside>
    </div>
  );
}
