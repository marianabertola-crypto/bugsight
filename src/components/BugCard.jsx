const STATUS_CLASS = {
  'Parking Lot': 'parking',
  Backlog: 'backlog',
  Discovery: 'discovery',
  'For Development': 'for-dev',
  Developing: 'developing',
  Developed: 'developed',
  Staging: 'staging',
};

const PRIORITY_CLASS = {
  Highest: 'highest',
  High: 'high',
  Medium: 'medium',
  Low: 'low',
  Lowest: 'lowest',
};

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function BugCard({ bug, moduleInfo, onConsultETA, onLoadETA, onDeleteETA, onNotes, onOpen }) {
  const hasSlack = !!(moduleInfo?.slackId);

  return (
    <div className="bug-card" onClick={() => onOpen?.(bug)} style={{ cursor: 'pointer' }}>
      <div className="bug-card-header">
        <div className="bug-card-meta">
          <span className="bug-id">{bug.id}</span>
          <span className={`bug-status status-${STATUS_CLASS[bug.status] || 'parking'}`}>{bug.status}</span>
          {bug.etaConsultations > 0 && !bug.eta && (
            <span className="eta-consultations" title="Consultas de ETA enviadas sin respuesta">
              🔔 ETA ×{bug.etaConsultations}
            </span>
          )}
        </div>
        <div className="bug-card-actions">
          <button
            className="btn-notes"
            onClick={(e) => { e.stopPropagation(); onNotes?.(bug); }}
            title="Ver notas"
          >
            📝 Notas {bug.notes?.length > 0 && <span className="notes-count">{bug.notes.length}</span>}
          </button>
        </div>
      </div>

      <div className="bug-title">{bug.title}</div>

      <div className="bug-card-footer">
        <div className="bug-footer-left">
          <span className={`bug-priority prio-${PRIORITY_CLASS[bug.priority]}`}>{bug.priority}</span>
          <span className="bug-date">🗓 {formatDate(bug.reportedAt)}</span>
        </div>
        <div className="bug-footer-right">
          {bug.eta ? (
            <>
              <button className="btn-eta btn-eta--received" disabled>✅ ETA: {formatDate(bug.eta)}</button>
              <button className="btn-eta btn-eta--pending" onClick={(e) => { e.stopPropagation(); onLoadETA?.(bug); }}>Editar ETA</button>
            </>
          ) : (
            <>
              <button className="btn-eta btn-eta--pending" onClick={(e) => { e.stopPropagation(); onLoadETA?.(bug); }}>Cargar ETA</button>
              {hasSlack && (
                <button className="btn-eta btn-eta--pending" onClick={(e) => { e.stopPropagation(); onConsultETA?.(bug); }}>Consultar ETA</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
