import { useState } from 'react';
import Modal from './Modal';
import { getPMForModule } from '../config/modules';
import './ETAModal.css';

function buildDefaultMessage(bug, pm) {
  return `Hola ${pm.pm}, ¿tenés ETA para el bug ${bug.id} - "${bug.title}"? Está afectando a ${bug.affectedClients.join(', ') || 'nuestros clientes'}. Prioridad: ${bug.priority}. ¡Gracias!`;
}

export default function ETAModal({ bug, onClose, onConfirm }) {
  const pm = getPMForModule(bug.module);
  const [message, setMessage] = useState(buildDefaultMessage(bug, pm));
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleConfirm() {
    setSending(true);

    // TODO(API) — NOT EXECUTED IN THIS VERSION.
    // This version does NOT send anything to Slack. The timeout below just
    // simulates network latency so the UX feels real during the demo.
    // When wiring the real integration:
    //   POST https://slack.com/api/chat.postMessage
    //   Headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } (SLACK_BOT_TOKEN starts with "xoxb-")
    //   Body: { channel: pm.slack, text: message }
    //   The Slack handle for the responsible PM lives in MODULE_PMS[bug.module].slack.
    //   Handle `response.ok === false` by surfacing the error to the support agent.
    await new Promise((resolve) => setTimeout(resolve, 600));

    onConfirm(bug.id);
    setSending(false);
    setSent(true);
    setTimeout(onClose, 900);
  }

  return (
    <Modal
      title={`Consultar ETA a ${pm.pm}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={sending}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={sending || sent || !message.trim()}
          >
            {sent ? 'Enviado ✓' : sending ? 'Enviando…' : 'Enviar por Slack'}
          </button>
        </>
      }
    >
      <div className="eta-modal-body">
        <div className="eta-modal-recipient">
          <span className="eta-modal-recipient-label">Canal destino</span>
          <span className="eta-modal-recipient-value">{pm.slack || 'Sin canal asignado'}</span>
        </div>
        <label className="eta-modal-label" htmlFor="eta-message">
          Mensaje (editable)
        </label>
        <textarea
          id="eta-message"
          className="eta-modal-textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
        />
      </div>
    </Modal>
  );
}
