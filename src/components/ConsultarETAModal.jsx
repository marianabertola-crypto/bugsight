import { useState } from 'react';

const CHANNEL = '#produc-etas-test';

const JIRA_BASE = 'https://humand.atlassian.net/browse';

function buildMessage(bug, moduleInfo) {
  const pmMention = moduleInfo?.slackId
    ? `<@${moduleInfo.slackId}>`
    : (moduleInfo?.pm || 'PM del módulo');
  const link = `<${JIRA_BASE}/${bug.id}|${bug.title}>`;
  return `🔔 *Consulta de ETA* — ${link}\n\nHola ${pmMention}! Te consulto sobre el bug: *${bug.title}* (${bug.id})\n\n¿Tenés estimación de cuándo podría estar resuelto? Gracias! 🙏`;
}

export default function ConsultarETAModal({ bug, moduleInfo, onClose }) {
  const [message, setMessage] = useState(() => buildMessage(bug, moduleInfo));
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/slack-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: CHANNEL, text: message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error enviando mensaje');
      setSent(true);
      setTimeout(onClose, 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="eta-modal-backdrop" onClick={onClose}>
      <div
        className="eta-modal"
        style={{ maxWidth: 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="eta-modal-title">💬 Consultar ETA por Slack</div>
            <div className="eta-modal-bug-id">{bug.id} · {bug.module || '—'}</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-secondary)', lineHeight: 1 }}
          >×</button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
          Se enviará al canal <strong>#produc-etas-test</strong>.
          {moduleInfo?.pm && <> Mencionando a <strong>{moduleInfo.pm}</strong>.</>}
          {' '}Podés editar antes de enviar.
        </p>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={7}
          style={{
            width: '100%', padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1.5px solid var(--color-border)',
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
            fontFamily: 'inherit', fontSize: 13,
            resize: 'vertical', lineHeight: 1.6,
            outline: 'none',
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; }}
        />

        {error && (
          <p style={{ color: 'var(--color-danger)', fontSize: 13, margin: 0 }}>⚠️ {error}</p>
        )}
        {sent && (
          <p style={{ color: 'var(--color-success)', fontSize: 13, margin: 0 }}>✅ Mensaje enviado a Slack!</p>
        )}

        <div className="eta-modal-actions">
          <button className="eta-btn eta-btn--secondary" onClick={onClose} disabled={sending}>
            Cancelar
          </button>
          <button className="eta-btn eta-btn--primary" onClick={handleSend} disabled={sending || sent}>
            {sending ? 'Enviando…' : 'Enviar a Slack'}
          </button>
        </div>
      </div>
    </div>
  );
}
