import PriorityBadge from './PriorityBadge';
import StatusBadge from './StatusBadge';
import { getPMForModule } from '../config/modules';
import './BugCard.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function BugCard({
  bug,
  variant = 'tracker',
  onRequestETA,
  onOpenNotes,
  draggable = false,
  onDragStart,
}) {
  const pendingEtaRequests = bug.etaRequests.filter((r) => !r.answered).length;

  if (variant === 'kanban') {
    const { pm } = getPMForModule(bug.module);
    return (
      <article
        className="bug-card bug-card-kanban"
        draggable={draggable}
        onDragStart={onDragStart}
      >
        <div className="bug-card-head">
          <span className="bug-id">{bug.id}</span>
          <PriorityBadge priority={bug.priority} />
        </div>
        <h4 className="bug-title">{bug.title}</h4>
        <div className="bug-card-meta">
          <span className="bug-module">{bug.module}</span>
          <span className="bug-pm">· {pm}</span>
        </div>
      </article>
    );
  }

  if (variant === 'history') {
    return (
      <article className="bug-card bug-card-history">
        <div className="bug-card-head">
          <span className="bug-id">{bug.id}</span>
          <span className="bug-module-tag">{bug.module}</span>
          <PriorityBadge priority={bug.priority} />
        </div>
        <h4 className="bug-title">{bug.title}</h4>
        <div className="bug-card-foot">
          <span className="bug-card-foot-label">Resuelto el</span>
          <span className="bug-card-foot-value">{formatDate(bug.resolvedAt)}</span>
        </div>
      </article>
    );
  }

  return (
    <article className="bug-card bug-card-tracker">
      <div className="bug-card-head">
        <span className="bug-id">{bug.id}</span>
        <StatusBadge status={bug.status} />
        <PriorityBadge priority={bug.priority} />
      </div>

      <h4 className="bug-title">{bug.title}</h4>

      <div className="bug-card-meta">
        <span>Reportado: {formatDate(bug.reportedAt)}</span>
        {bug.affectedClients.length > 0 && (
          <span>· {bug.affectedClients.length} cliente{bug.affectedClients.length > 1 ? 's' : ''}</span>
        )}
      </div>

      {pendingEtaRequests > 0 && (
        <div className="bug-eta-history">
          ETA consultada {pendingEtaRequests} {pendingEtaRequests === 1 ? 'vez' : 'veces'} sin respuesta
        </div>
      )}

      <div className="bug-card-actions">
        {bug.eta ? (
          <button className="btn btn-ghost" disabled>
            ETA recibida: {formatDate(bug.eta)}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => onRequestETA(bug)}>
            Consultar ETA
          </button>
        )}
        <button className="btn btn-secondary" onClick={() => onOpenNotes(bug)}>
          Notas {bug.notes.length > 0 ? `(${bug.notes.length})` : ''}
        </button>
      </div>
    </article>
  );
}
