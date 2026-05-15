import { useState } from 'react';

const CHANNEL = 'C08TTLB49GT'; // #prueba-product-etas channel ID

function buildMessage(bug, moduleInfo) {
  const pmMention = moduleInfo?.slackId ? `<@${moduleInfo.slackId}>` : (moduleInfo?.pm || 'PM del módulo');
  return `🔔 *Consulta de ETA* — ${bug.id}\n\nHola ${pmMention}! Te consulto sobre el bug: *${bug.title}*\n\n¿Tenés estimación de cuándo podría estar resuelto? Gracias! 🙏`;
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
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 className="modal-title">💬 Consultar ETA por Slack</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
            Se enviará al canal <strong>#prueba-product-etas</strong>. Podés editar el mensaje antes de enviarlo.
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)', background: 'var(--color-bg)',
              color: 'var(--color-text)', fontFamily: 'inherit', fontSize: 13,
              resize: 'vertical', lineHeight: 1.5,
            }}
          />
          {error && <p style={{ color: 'var(--color-danger)', fontSize: 13, margin: 0 }}>{error}</p>}
          {sent && <p style={{ color: 'var(--color-success)', fontSize: 13, margin: 0 }}>✅ Mensaje enviado!</p>}
        </div>
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px' }}>
          <button className="btn-secondary" onClick={onClose} disabled={sending}>Cancelar</button>
          <button className="btn-primary" onClick={handleSend} disabled={sending || sent}>
            {sending ? 'Enviando…' : 'Enviar a Slack'}
          </button>
        </div>
      </div>
    </div>
  );
}
