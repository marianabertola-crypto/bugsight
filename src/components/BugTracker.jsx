import { useState, useMemo } from 'react';
import { MODULES } from '../config/modules';
import FilterBar from './FilterBar';
import BugCard from './BugCard';
import ETAModal from './ETAModal';
import NotesModal from './NotesModal';
import IssueModal from './IssueModal';
import ConsultarETAModal from './ConsultarETAModal';

const STATUSES = ['Parking Lot', 'Backlog', 'Discovery', 'For Development', 'Developing', 'Developed', 'Staging', 'Closed', 'Released'];
const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
const PRIORITY_ORDER = { Highest: 0, High: 1, Medium: 2, Low: 3, Lowest: 4 };
const PAGE_SIZE = 15;

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function BugTracker({
  bugs,
  loading,
  filters,
  onFiltersChange,
  sortBy,
  onSortChange,
  onRefresh,
  refreshing,
  selectedBug,
  etaBug,
  notesBug,
  onOpenBug,
  onCloseModal,
  onOpenETA,
  onCloseETA,
  onSaveETA,
  onDeleteETA,
  onOpenNotes,
  onCloseNotes,
  onAddNote,
  onDeleteNote,
  onEditNote,
  user,
}) {
  const [expanded, setExpanded] = useState({});
  const [consultBug, setConsultBug] = useState(null);

  // Group by miniApps (a bug can appear in multiple groups)
  const grouped = useMemo(() => {
    const map = {};
    for (const bug of bugs) {
      const keys = bug.miniApps?.length ? bug.miniApps : [bug.module];
      for (const key of keys) {
        if (!map[key]) map[key] = [];
        map[key].push(bug);
      }
    }

    for (const key of Object.keys(map)) {
      const list = map[key];
      if (sortBy === 'priority') {
        map[key] = [...list].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99));
      } else if (sortBy === 'date-desc') {
        map[key] = [...list].sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
      } else if (sortBy === 'date-asc') {
        map[key] = [...list].sort((a, b) => a.reportedAt.localeCompare(b.reportedAt));
      }
    }

    return Object.keys(map).sort((a, b) => a.localeCompare(b)).map((key) => ({ module: key, bugs: map[key] }));
  }, [bugs, sortBy]);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
        <p>Cargando bugs desde Jira…</p>
      </div>
    );
  }

  return (
    <>
      <FilterBar
        filters={filters}
        onChange={onFiltersChange}
        onRefresh={onRefresh}
        refreshing={refreshing}
        statuses={STATUSES}
        priorities={PRIORITIES}
      />

      <div className="app-bugs-toolbar">
        <span className="app-bugs-count">{bugs.length} bug{bugs.length !== 1 ? 's' : ''}</span>
        <div className="app-sort">
          <span className="app-sort-label">Ordenar:</span>
          <select className="app-sort-select" value={sortBy} onChange={(e) => onSortChange(e.target.value)}>
            <option value="priority">Prioridad</option>
            <option value="date-desc">Fecha (más reciente)</option>
            <option value="date-asc">Fecha (más antiguo)</option>
          </select>
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="bug-list-empty">
          <span className="bug-list-empty-icon">🔍</span>
          <p>No se encontraron bugs con los filtros aplicados.</p>
        </div>
      ) : (
        <div className="bug-list">
          {grouped.map(({ module, bugs: moduleBugs }) => {
            const moduleInfo = MODULES[module] || { pm: null, slackId: null };
            const isExpanded = expanded[module];
            const visible = isExpanded ? moduleBugs : moduleBugs.slice(0, PAGE_SIZE);
            const remaining = moduleBugs.length - PAGE_SIZE;

            return (
              <div key={module} className="bug-module-group">
                <div className="bug-module-header">
                  <div className="bug-module-title">
                    <span className="bug-module-name">{module}</span>
                    <span className="bug-module-count">{moduleBugs.length} bug{moduleBugs.length !== 1 ? 's' : ''}</span>
                    {moduleInfo.pm && <span className="bug-module-pm">PM: {moduleInfo.pm}</span>}
                  </div>
                </div>
                <div className="bug-module-cards">
                  {visible.map((bug) => (
                    <BugCard
                      key={bug.id}
                      bug={bug}
                      moduleInfo={moduleInfo}
                      onConsultETA={(b) => setConsultBug(b)}
                      onLoadETA={onOpenETA}
                      onDeleteETA={onDeleteETA}
                      onNotes={onOpenNotes}
                      onOpen={onOpenBug}
                    />
                  ))}
                  {!isExpanded && remaining > 0 && (
                    <button className="bug-module-expand" onClick={() => setExpanded((p) => ({ ...p, [module]: true }))}>
                      Ver {remaining} más…
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedBug && (
        <IssueModal issueKey={selectedBug.id} bug={selectedBug} onClose={onCloseModal} />
      )}

      {etaBug && (
        <ETAModal
          bug={etaBug}
          onClose={onCloseETA}
          onSave={onSaveETA}
          onDelete={onDeleteETA}
        />
      )}

      {notesBug && (
        <NotesModal
          bug={notesBug}
          user={user}
          onClose={onCloseNotes}
          onAddNote={onAddNote}
          onDeleteNote={onDeleteNote}
          onEditNote={onEditNote}
        />
      )}

      {consultBug && (
        <ConsultarETAModal
          bug={consultBug}
          moduleInfo={MODULES[consultBug.miniApps?.[0] || consultBug.module] || {}}
          onClose={() => setConsultBug(null)}
        />
      )}
    </>
  );
}
