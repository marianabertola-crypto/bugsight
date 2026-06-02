import { useState, useMemo } from 'react';
import { MODULES } from '../config/modules';
import FilterBar from './FilterBar';
import BugCard from './BugCard';
import ETAModal from './ETAModal';
import NotesModal from './NotesModal';
import IssueModal from './IssueModal';
import ConsultarETAModal from './ConsultarETAModal';

const STATUSES = ['Parking Lot', 'Backlog', 'Discovery', 'For Development', 'Developing', 'Developed', 'Staging', 'Closed', 'Released'];
const ACTIVE_STATUSES = ['Parking Lot', 'Backlog', 'Discovery', 'For Development', 'Developing', 'Developed', 'Staging'];
const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
const PRIORITY_ORDER = { Highest: 0, High: 1, Medium: 2, Low: 3, Lowest: 4 };
const PAGE_SIZE = 15;

const SENSITIVE_TABS = [
  { id: 'all', label: 'Todos los sensibles' },
  { id: 'active', label: 'Actualmente sensibles' },
  { id: 'former', label: 'Dejaron de estar sensibles' },
];

function norm(s) {
  return s?.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim() ?? '';
}

function SensitiveView({ allBugs, sensitiveClients, onOpenBug, onOpenETA, onDeleteETA, onOpenNotes, etaBug, onCloseETA, onSaveETA, notesBug, onCloseNotes, onAddNote, onDeleteNote, onEditNote, user, selectedBug, onCloseModal }) {
  const [sensitiveTab, setSensitiveTab] = useState('all');
  const [consultBug, setConsultBug] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [statusFilter, setStatusFilter] = useState([]); // [] = default (exclude Closed/Released)

  const sensitiveNames = useMemo(() => new Set(sensitiveClients.map((c) => norm(c.name))), [sensitiveClients]);
  const activeNames = useMemo(() => new Set(sensitiveClients.filter((c) => c.currently_sensitive).map((c) => norm(c.name))), [sensitiveClients]);
  const formerNames = useMemo(() => new Set(sensitiveClients.filter((c) => !c.currently_sensitive).map((c) => norm(c.name))), [sensitiveClients]);

  const nameSet = sensitiveTab === 'active' ? activeNames : sensitiveTab === 'former' ? formerNames : sensitiveNames;

  const filteredBugs = useMemo(() => {
    return allBugs.filter((b) => {
      if (!(b.affectedClients || []).some((c) => nameSet.has(norm(c)))) return false;
      if (statusFilter.length) return statusFilter.includes(b.status);
      return b.status !== 'Closed' && b.status !== 'Released';
    });
  }, [allBugs, nameSet, statusFilter]);

  // Group by client name (sensitive)
  const grouped = useMemo(() => {
    const map = {};
    for (const bug of filteredBugs) {
      const matchingClients = (bug.affectedClients || []).filter((c) => nameSet.has(norm(c)));
      for (const client of matchingClients) {
        const key = client;
        if (!map[key]) map[key] = [];
        if (!map[key].find((b) => b.id === bug.id)) map[key].push(bug);
      }
    }
    return Object.keys(map).sort((a, b) => a.localeCompare(b)).map((client) => ({
      client,
      bugs: map[client].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)),
      isCurrent: activeNames.has(norm(client)),
    }));
  }, [filteredBugs, nameSet, activeNames]);

  if (sensitiveClients.length === 0) {
    return (
      <div className="bug-list-empty">
        <span className="bug-list-empty-icon">⏳</span>
        <p>Cargando lista de clientes sensibles…</p>
      </div>
    );
  }

  return (
    <>
      {/* Sub-tabs */}
      <div className="sensitive-tabs">
        {SENSITIVE_TABS.map((t) => (
          <button
            key={t.id}
            className={`sensitive-tab${sensitiveTab === t.id ? ' active' : ''}`}
            onClick={() => { setSensitiveTab(t.id); setExpanded({}); }}
          >
            {t.label}
            <span className="sensitive-tab-count">
              {t.id === 'all' ? sensitiveNames.size : t.id === 'active' ? activeNames.size : formerNames.size}
            </span>
          </button>
        ))}
      </div>

      {/* Status filter */}
      <div className="sensitive-status-bar">
        <span className="sensitive-status-label">Estado:</span>
        <div className="sensitive-status-pills">
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`sensitive-status-pill${statusFilter.includes(s) ? ' active' : ''}`}
              onClick={() => {
                setStatusFilter((prev) =>
                  prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                );
                setExpanded({});
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="app-bugs-toolbar">
        <span className="app-bugs-count">{filteredBugs.length} bug{filteredBugs.length !== 1 ? 's' : ''} en {grouped.length} cliente{grouped.length !== 1 ? 's' : ''}</span>
      </div>

      {grouped.length === 0 ? (
        <div className="bug-list-empty">
          <span className="bug-list-empty-icon">✅</span>
          <p>No hay bugs reportados para clientes en esta categoría.</p>
        </div>
      ) : (
        <div className="bug-list">
          {grouped.map(({ client, bugs: clientBugs, isCurrent }) => {
            const isExpanded = expanded[client];
            const visible = isExpanded ? clientBugs : clientBugs.slice(0, PAGE_SIZE);
            const remaining = clientBugs.length - PAGE_SIZE;
            return (
              <div key={client} className="bug-module-group">
                <div className="bug-module-header">
                  <div className="bug-module-title">
                    <span className="bug-module-name">{client}</span>
                    <span className="bug-module-count">{clientBugs.length} bug{clientBugs.length !== 1 ? 's' : ''}</span>
                    <span className={`sensitive-badge${isCurrent ? ' sensitive-badge--active' : ' sensitive-badge--former'}`}>
                      {isCurrent ? '🔴 Sensible actualmente' : '🟡 Fue sensible'}
                    </span>
                  </div>
                </div>
                <div className="bug-module-cards">
                  {visible.map((bug) => {
                    const moduleInfo = MODULES[bug.miniApps?.[0] || bug.module] || {};
                    return (
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
                    );
                  })}
                  {!isExpanded && remaining > 0 && (
                    <button className="bug-module-expand" onClick={() => setExpanded((p) => ({ ...p, [client]: true }))}>
                      Ver {remaining} más…
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedBug && <IssueModal issueKey={selectedBug.id} bug={selectedBug} onClose={onCloseModal} />}
      {etaBug && <ETAModal bug={etaBug} onClose={onCloseETA} onSave={onSaveETA} onDelete={onDeleteETA} />}
      {notesBug && <NotesModal bug={notesBug} user={user} onClose={onCloseNotes} onAddNote={onAddNote} onDeleteNote={onDeleteNote} onEditNote={onEditNote} />}
      {consultBug && <ConsultarETAModal bug={consultBug} moduleInfo={MODULES[consultBug.miniApps?.[0] || consultBug.module] || {}} onClose={() => setConsultBug(null)} />}
    </>
  );
}

export default function BugTracker({
  bugs,
  allBugs,
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
  sensitiveClients = [],
}) {
  const [expanded, setExpanded] = useState({});
  const [consultBug, setConsultBug] = useState(null);
  const [activeTab, setActiveTab] = useState('bugs');

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

  const activeSensitiveCount = sensitiveClients.filter((c) => c.currently_sensitive).length;

  return (
    <>
      {/* Main tabs */}
      <div className="bt-main-tabs">
        <button
          className={`bt-main-tab${activeTab === 'bugs' ? ' active' : ''}`}
          onClick={() => setActiveTab('bugs')}
        >
          Todos los bugs
        </button>
        <button
          className={`bt-main-tab${activeTab === 'sensitive' ? ' active' : ''}`}
          onClick={() => setActiveTab('sensitive')}
        >
          Clientes sensibles
          {activeSensitiveCount > 0 && (
            <span className="bt-main-tab-badge">{activeSensitiveCount} activos</span>
          )}
        </button>
      </div>

      {activeTab === 'sensitive' ? (
        <SensitiveView
          allBugs={allBugs || bugs}
          sensitiveClients={sensitiveClients}
          onOpenBug={onOpenBug}
          onOpenETA={onOpenETA}
          onDeleteETA={onDeleteETA}
          onOpenNotes={onOpenNotes}
          etaBug={etaBug}
          onCloseETA={onCloseETA}
          onSaveETA={onSaveETA}
          notesBug={notesBug}
          onCloseNotes={onCloseNotes}
          onAddNote={onAddNote}
          onDeleteNote={onDeleteNote}
          onEditNote={onEditNote}
          user={user}
          selectedBug={selectedBug}
          onCloseModal={onCloseModal}
        />
      ) : (
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
      )}
    </>
  );
}
