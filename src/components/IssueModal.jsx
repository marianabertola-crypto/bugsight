import { useState, useEffect } from 'react';

function renderDescription(doc) {
  if (!doc) return null;
  if (typeof doc === 'string') return doc;
  if (doc.type === 'doc') return doc.content?.map((n, i) => renderNode(n, i));
  return null;
}

function renderNode(node, key) {
  if (!node) return null;
  if (node.type === 'paragraph') {
    return <p key={key} style={{ margin: '4px 0' }}>{node.content?.map((n, i) => renderNode(n, i))}</p>;
  }
  if (node.type === 'text') {
    let el = <span key={key}>{node.text}</span>;
    if (node.marks?.some((m) => m.type === 'strong')) el = <strong key={key}>{node.text}</strong>;
    if (node.marks?.some((m) => m.type === 'em')) el = <em key={key}>{node.text}</em>;
    return el;
  }
  if (node.type === 'bulletList') {
    return <ul key={key}>{node.content?.map((n, i) => renderNode(n, i))}</ul>;
  }
  if (node.type === 'orderedList') {
    return <ol key={key}>{node.content?.map((n, i) => renderNode(n, i))}</ol>;
  }
  if (node.type === 'listItem') {
    return <li key={key}>{node.content?.map((n, i) => renderNode(n, i))}</li>;
  }
  if (node.type === 'hardBreak') return <br key={key} />;
  return null;
}

function formatDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function IssueModal({ issueKey, bug, onClose }) {
  const [jiraData, setJiraData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!issueKey) return;
    setLoading(true);
    setError(null);
    fetch(`/api/jira-search?jql=key=${issueKey}&fields=reporter,description,comment&maxResults=1`)
      .then((r) => r.json())
      .then((d) => setJiraData(d.issues?.[0]?.fields || null))
      .catch(() => setError('No se pudo cargar el detalle.'))
      .finally(() => setLoading(false));
  }, [issueKey]);

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  const reporter = jiraData?.reporter?.displayName;
  const description = jiraData?.description;
  const comments = jiraData?.comment?.comments || [];

  return (
    <div className="issue-modal-backdrop" onClick={onBackdropClick}>
      <div className="issue-modal">
        {/* Header */}
        <div className="issue-modal-header">
          <div className="issue-modal-key-row">
            <span className="issue-modal-key">{issueKey}</span>
            <a
              className="issue-modal-jira-link"
              href={`https://humand.atlassian.net/browse/${issueKey}`}
              target="_blank"
              rel="noreferrer"
            >
              Ver en Jira ↗
            </a>
          </div>
          <button className="issue-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Title */}
        {bug?.title && <h2 className="issue-modal-title">{bug.title}</h2>}

        {/* Badges + reporter + date */}
        <div className="issue-modal-meta">
          {bug?.status && <span className="issue-modal-badge status">{bug.status}</span>}
          {bug?.priority && (
            <span className={`issue-modal-badge priority priority-${bug.priority.toLowerCase()}`}>
              {bug.priority}
            </span>
          )}
          {bug?.module && <span className="issue-modal-badge module">{bug.module}</span>}
          {reporter && (
            <span className="issue-modal-meta-text">
              Reportado por <strong>{reporter}</strong>
            </span>
          )}
          {bug?.reportedAt && (
            <span className="issue-modal-meta-text">{formatDate(bug.reportedAt)}</span>
          )}
        </div>

        {/* Info row: ETA / Clientes / miniApps */}
        {(bug?.eta || (bug?.affectedClients?.length > 0) || (bug?.miniApps?.length > 0)) && (
          <div className="issue-modal-info-row">
            {bug.eta && (
              <div className="issue-modal-info-item">
                <span className="issue-modal-info-label">ETA</span>
                <span className="issue-modal-info-value">{formatDate(bug.eta)}</span>
              </div>
            )}
            {bug.affectedClients?.length > 0 && (
              <div className="issue-modal-info-item issue-modal-info-item--wide">
                <span className="issue-modal-info-label">
                  Clientes afectados ({bug.affectedClients.length}
                  {bug.affectedClientsSize ? ` · ${bug.affectedClientsSize}` : ''})
                </span>
                <div className="issue-modal-client-tags">
                  {bug.affectedClients.map((c) => (
                    <span key={c} className="issue-modal-client-tag">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {bug.miniApps?.length > 0 && (
              <div className="issue-modal-info-item">
                <span className="issue-modal-info-label">Mini Apps</span>
                <span className="issue-modal-info-value">{bug.miniApps.join(', ')}</span>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="issue-modal-loading">
            <div className="issue-modal-spinner" />
            Cargando detalle…
          </div>
        )}
        {error && <div className="issue-modal-error">{error}</div>}

        {/* Body: description + comments */}
        <div className="issue-modal-body">
          {description
            ? <div className="issue-modal-description">{renderDescription(description)}</div>
            : !loading && <p className="issue-modal-no-desc">Sin descripción.</p>}

          {comments.length > 0 && (
            <div className="issue-modal-comments">
              <h3 className="issue-modal-comments-title">Comentarios ({comments.length})</h3>
              {comments.map((c) => (
                <div key={c.id} className="issue-comment">
                  <div className="issue-comment-header">
                    <span className="issue-comment-author">{c.author?.displayName}</span>
                    <span className="issue-comment-date">
                      {new Date(c.created).toLocaleDateString('es-AR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="issue-comment-body">{renderDescription(c.body)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
