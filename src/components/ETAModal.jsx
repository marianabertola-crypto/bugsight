import { useState } from 'react';

export default function ETAModal({ bug, onClose, onSave, onDelete }) {
  const [date, setDate] = useState(bug.eta || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!date) return;
    setSaving(true);
    try {
      await onSave(bug.id, date);
      onClose();
    } catch (err) {
      console.error('Error guardando ETA:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await onDelete(bug.id);
  }

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="eta-modal-backdrop" onClick={onBackdropClick}>
      <div className="eta-modal">
        <p className="eta-modal-title">{bug.eta ? 'Editar ETA' : 'Cargar ETA'}</p>
        <p className="eta-modal-bug-id">{bug.id} — {bug.title.length > 60 ? bug.title.slice(0, 60) + '…' : bug.title}</p>
        <input
          type="date"
          className="eta-modal-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className="eta-modal-actions">
          {bug.eta && (
            <button className="eta-btn eta-btn--secondary" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={handleDelete}>
              Eliminar ETA
            </button>
          )}
          <button className="eta-btn eta-btn--secondary" onClick={onClose}>Cancelar</button>
          <button className="eta-btn eta-btn--primary" onClick={handleSave} disabled={!date || saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
