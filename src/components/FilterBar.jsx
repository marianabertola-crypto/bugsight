import { useState } from 'react';

export default function FilterBar({ filters, onChange, onRefresh, refreshing, statuses, priorities }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { etaFilter, statuses: selStatuses, priorities: selPriorities, search, dateFrom, dateTo } = filters;

  const activeCount = selStatuses.length + selPriorities.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  function toggleStatus(s) {
    const next = selStatuses.includes(s) ? selStatuses.filter((x) => x !== s) : [...selStatuses, s];
    onChange({ ...filters, statuses: next });
  }

  function togglePriority(p) {
    const next = selPriorities.includes(p) ? selPriorities.filter((x) => x !== p) : [...selPriorities, p];
    onChange({ ...filters, priorities: next });
  }

  return (
    <div className="filter-bar">
      <div className="filter-bar-top">
        <div className="filter-main-buttons">
          {[['all', 'Todos'], ['sin-eta', 'Sin ETA'], ['con-eta', 'Con ETA']].map(([key, label]) => (
            <button
              key={key}
              className={`filter-btn${etaFilter === key ? ' active' : ''}`}
              onClick={() => onChange({ ...filters, etaFilter: key })}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="filter-search-row">
          <div className="filter-search">
            <span className="filter-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Buscar por título, ID, módulo o cliente…"
              value={search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
            />
            {search && (
              <button className="filter-search-clear" onClick={() => onChange({ ...filters, search: '' })}>×</button>
            )}
          </div>
          <button
            className={`btn-refresh-inline${refreshing ? ' spinning' : ''}`}
            onClick={onRefresh}
            disabled={refreshing}
            title="Actualizar bugs desde Jira"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
          <button
            className={`filter-funnel${activeCount > 0 ? ' has-filters' : ''}`}
            onClick={() => setShowAdvanced((p) => !p)}
            title="Filtros avanzados"
          >
            ⚙
            {activeCount > 0 && <span className="filter-badge">{activeCount}</span>}
          </button>
        </div>
      </div>

      {showAdvanced && (
        <div className="filter-advanced">
          <div className="filter-group">
            <span className="filter-group-label">Estado</span>
            <div className="filter-chips">
              {statuses.map((s) => (
                <button
                  key={s}
                  className={`filter-chip${selStatuses.includes(s) ? ' active' : ''}`}
                  onClick={() => toggleStatus(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-group-label">Prioridad</span>
            <div className="filter-chips">
              {priorities.map((p) => (
                <button
                  key={p}
                  className={`filter-chip${selPriorities.includes(p) ? ' active' : ''}`}
                  onClick={() => togglePriority(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-group-label">Fecha de reporte</span>
            <div className="filter-date-row">
              <input
                type="date"
                className="filter-date-input"
                value={dateFrom}
                onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
              />
              <span className="filter-date-sep">→</span>
              <input
                type="date"
                className="filter-date-input"
                value={dateTo}
                onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
