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
    return <span key={key}>{node.text}</span>;
  }
  if (node.type === 'bulletList') {
    return <ul key={key}>{node.content?.map((n, i) => renderNode(n, i))}</ul>;
  }
  if (node.type === 'listItem') {
    return <li key={key}>{node.content?.map((n, i) => renderNode(n, i))}</li>;
  }
  return null;
}

export default function IssueModal({ issueKey, onClose }) {
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!issueKey) return;
    setLoading(true);
    setError(null);

    fetch(`/api/jira-search?jql=key=${issueKey}&fields=summary,status,priority,reporter,created,description,comment&maxResults=1`)
      .then((r) => r.json())
      .then((d) => setIssue(d.issues?.[0] || null))
      .catch(() => setError('No se pudo cargar el issue.'))
      .finally(() => setLoading(false));
  }, [issueKey]);

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  const fields = issue?.fields;

  return (
    <div className="issue-modal-backdrop" onClick={onBackdropClick}>
      <div className="issue-modal">
        <div className="issue-modal-header">
          <div className="issue-modal-key-row">
            <span className="issue-modal-key">{issueKey}</span>
            {fields && (
              <a className="issue-modal-jira-link" href={`https://humand.atlassian.net/browse/${issueKey}`} target="_blank" rel="noreferrer">
                Ver en Jira ↗
              </a>
            )}
          </div>
          <button className="issue-modal-close" onClick={onClose}>✕</button>
        </div>

        {loading && (
          <div className="issue-modal-loading">
            <div className="issue-modal-spinner" />
            Cargando…
          </div>
        )}
        {error && <div className="issue-modal-error">{error}</div>}

        {fields && (
          <>
            <h2 className="issue-modal-title">{fields.summary}</h2>
            <div className="issue-modal-meta">
              <span className="issue-modal-badge status">{fields.status?.name}</span>
              <span className={`issue-modal-badge priority priority-${fields.priority?.name?.toLowerCase()}`}>{fields.priority?.name}</span>
              {fields.reporter && (
                <span className="issue-modal-meta-text">Reportado por <strong>{fields.reporter.displayName}</strong></span>
              )}
              {fields.created && (
                <span className="issue-modal-meta-text">
                  {new Date(fields.created).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              )}
            </div>
            <div className="issue-modal-body">
              {fields.description
                ? <div className="issue-modal-description">{renderDescription(fields.description)}</div>
                : <p className="issue-modal-no-desc">Sin descripción.</p>}

              {fields.comment?.comments?.length > 0 && (
                <div className="issue-modal-comments">
                  <h3 className="issue-modal-comments-title">Comentarios ({fields.comment.comments.length})</h3>
                  {fields.comment.comments.map((c) => (
                    <div key={c.id} className="issue-comment">
                      <div className="issue-comment-header">
                        <span className="issue-comment-author">{c.author?.displayName}</span>
                        <span className="issue-comment-date">
                          {new Date(c.created).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="issue-comment-body">{renderDescription(c.body)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
