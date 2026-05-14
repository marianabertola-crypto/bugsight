import { useState } from 'react';
import { supabase } from '../lib/supabase';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function NotesModal({ bug, user, onClose, onAddNote, onDeleteNote, onEditNote }) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  async function handleAdd() {
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('notes').insert({
        bug_id: bug.id,
        text,
        author: user?.name || 'Soporte',
      }).select().single();
      if (error) throw error;
      onAddNote?.(bug.id, data);
      setDraft('');
    } catch (err) {
      console.error('Error agregando nota:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(noteId) {
    await supabase.from('notes').delete().eq('id', noteId);
    onDeleteNote?.(bug.id, noteId);
  }

  async function handleEditSave(noteId) {
    const text = editText.trim();
    if (!text) return;
    await supabase.from('notes').update({ text }).eq('id', noteId);
    onEditNote?.(bug.id, noteId, text);
    setEditingId(null);
  }

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="notes-modal-backdrop" onClick={onBackdropClick}>
      <div className="notes-modal">
        <div className="notes-modal-header">
          <span className="notes-modal-title">Notas — {bug.id}</span>
          <button className="notes-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="notes-modal-body">
          {bug.notes?.length === 0 && (
            <p className="notes-empty">Sin notas todavía.</p>
          )}
          {bug.notes?.map((note) => (
            <div key={note.id} className="note-item">
              <div className="note-item-header">
                <div>
                  <span className="note-author">{note.author}</span>
                  <span className="note-date"> · {formatDate(note.created_at)}</span>
                </div>
                <div className="note-actions">
                  <button className="note-btn" onClick={() => { setEditingId(note.id); setEditText(note.text); }}>Editar</button>
                  <button className="note-btn note-btn--danger" onClick={() => handleDelete(note.id)}>Eliminar</button>
                </div>
              </div>
              {editingId === note.id ? (
                <>
                  <textarea className="note-edit-input" value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} />
                  <div className="note-actions" style={{ marginTop: 6 }}>
                    <button className="note-btn" onClick={() => handleEditSave(note.id)}>Guardar</button>
                    <button className="note-btn" onClick={() => setEditingId(null)}>Cancelar</button>
                  </div>
                </>
              ) : (
                <p className="note-text">{note.text}</p>
              )}
            </div>
          ))}
        </div>

        <div className="notes-modal-footer">
          <textarea
            className="notes-input"
            placeholder="Escribí una nota interna…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
          />
          <button className="notes-add-btn" onClick={handleAdd} disabled={!draft.trim() || saving}>
            {saving ? 'Guardando…' : 'Agregar nota'}
          </button>
        </div>
      </div>
    </div>
  );
}
