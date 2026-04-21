import { useState } from 'react';
import Modal from './Modal';
import './NotesModal.css';

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotesModal({ bug, onClose, onAddNote }) {
  const [draft, setDraft] = useState('');

  function handleAdd() {
    const text = draft.trim();
    if (!text) return;
    onAddNote(bug.id, {
      author: 'Soporte',
      text,
      createdAt: new Date().toISOString(),
    });
    setDraft('');
  }

  return (
    <Modal
      title={`Notas internas — ${bug.id}`}
      onClose={onClose}
      footer={
        <button className="btn btn-secondary" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      <div className="notes-modal-body">
        <p className="notes-modal-subtitle">{bug.title}</p>

        <div className="notes-list">
          {bug.notes.length === 0 && (
            <div className="notes-empty">Todavía no hay notas para este bug.</div>
          )}
          {bug.notes.map((note, idx) => (
            <div className="note-item" key={idx}>
              <div className="note-head">
                <span className="note-author">{note.author}</span>
                <span className="note-date">{formatDateTime(note.createdAt)}</span>
              </div>
              <p className="note-text">{note.text}</p>
            </div>
          ))}
        </div>

        <div className="notes-composer">
          <textarea
            rows={3}
            placeholder="Escribí una nota interna para el equipo…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="btn btn-primary" onClick={handleAdd} disabled={!draft.trim()}>
            Agregar nota
          </button>
        </div>
      </div>
    </Modal>
  );
}
