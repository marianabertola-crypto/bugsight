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

const RED_LIST_CATEGORIES = ['Red List', 'Success Red List', 'Onboarding Red List'];

function norm(s) {
  return s?.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim() ?? '';
}

// Fuzzy normalization for Red List: strips [bracket] prefixes, date suffixes, and spaces
// e.g. "[Inbound] Nuvemshop Brasil" → "nuvemshopbrasil"
//      "XPLOY - February 2025"      → "xploy"
//      "Tigo Paraguay- ene 2026"    → "tigoparaguay"
function normRedList(s) {
  if (!s) return '';
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\[.*?\]\s*/g, '')
    .replace(/\s*[-–]\s*(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|mar|apr|aug|december|november|october|september|august|july|june|april|march|february|january)\s*\d{4}/gi, '')
    .replace(/\s*[-–]\s*\d{4}/g, '')
    .replace(/[.\s]/g, '')
    .toLowerCase()
    .trim();
}

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTodayLabel() {
  const d = new Date();
  return `Reportados hoy (${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')})`;
}

function Metrics({ metrics, loading }) {
  return (
    <div className="bt-metrics-row">
      {metrics.map((m) => (
        <div key={m.label} className="bt-metric-card">
          <span className="bt-metric-icon">{m.icon}</span>
          <div>
            <div className="bt-metric-value" style={{ color: m.color }}>
              {loading ? '—' : m.value}
            </div>
            <div className="bt-metric-label">{m.label}</div>
          </div>
        </div>
      ))}
    </div>
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
  redListClients = [],
}) {
  const [expanded, setExpanded] = useState({});
  const [consultBug, setConsultBug] = useState(null);
  const [activeTab, setActiveTab] = useState('bugs');

  // Sensitive state
  const [sensitiveTab, setSensitiveTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState([]);

  // Red List state
  const [redListCategory, setRedListCategory] = useState('all');
  const [redListStatusFilter, setRedListStatusFilter] = useState([]);

  // --- Sensitive data ---
  const sensitiveNames = useMemo(() => new Set(sensitiveClients.map((c) => norm(c.name))), [sensitiveClients]);
  const activeNames = useMemo(() => new Set(sensitiveClients.filter((c) => c.currently_sensitive).map((c) => norm(c.name))), [sensitiveClients]);
  const formerNames = useMemo(() => new Set(sensitiveClients.filter((c) => !c.currently_sensitive).map((c) => norm(c.name))), [sensitiveClients]);
  const nameSet = sensitiveTab === 'active' ? activeNames : sensitiveTab === 'former' ? formerNames : sensitiveNames;

  const sensitiveBugs = useMemo(() => {
    return (allBugs || bugs).filter((b) => {
      if (!(b.affectedClients || []).some((c) => nameSet.has(norm(c)))) return false;
      if (statusFilter.length) return statusFilter.includes(b.status);
      return b.status !== 'Closed' && b.status !== 'Released';
    });
  }, [allBugs, bugs, nameSet, statusFilter]);

  const sensitiveClientCount = nameSet.size;

  // --- Red List data ---
  const redListByCategory = useMemo(() => {
    const map = {};
    for (const c of redListClients) {
      const cat = c.category;
      if (!map[cat]) map[cat] = new Set();
      map[cat].add(normRedList(c.name));
    }
    return map;
  }, [redListClients]);

  const redListNameSet = useMemo(() => {
    if (redListCategory === 'all') return new Set(redListClients.map((c) => normRedList(c.name)));
    return redListByCategory[redListCategory] || new Set();
  }, [redListClients, redListCategory, redListByCategory]);

  const redListBugs = useMemo(() => {
    return (allBugs || bugs).filter((b) => {
      if (!(b.affectedClients || []).some((c) => redListNameSet.has(normRedList(c)))) return false;
      if (redListStatusFilter.length) return redListStatusFilter.includes(b.status);
      return b.status !== 'Closed' && b.status !== 'Released';
    });
  }, [allBugs, bugs, redListNameSet, redListStatusFilter]);

  const redListGrouped = useMemo(() => {
    const map = {};
    for (const bug of redListBugs) {
      const matchingClients = (bug.affectedClients || []).filter((c) => redListNameSet.has(normRedList(c)));
      for (const client of matchingClients) {
        if (!map[client]) map[client] = [];
        if (!map[client].find((b) => b.id === bug.id)) map[client].push(bug);
      }
    }
    return Object.keys(map).sort((a, b) => a.localeCompare(b)).map((client) => {
      const clientData = redListClients.find((c) => norm(c.name) === norm(client));
      return {
        client,
        category: clientData?.category || '',
        bugs: map[client].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)),
      };
    });
  }, [redListBugs, redListNameSet, redListClients]);

  // Available categories in current data
  const availableCategories = useMemo(() => {
    return RED_LIST_CATEGORIES.filter((cat) => redListByCategory[cat]?.size > 0);
  }, [redListByCategory]);

  // --- Metrics ---
  const generalMetrics = [
    { label: 'Bugs activos', value: bugs.length, icon: '🐛', color: 'var(--color-primary)' },
    { label: 'Críticos / Alta prioridad', value: bugs.filter((b) => b.priority === 'Highest' || b.priority === 'High').length, icon: '🔴', color: 'var(--color-danger)' },
    { label: 'Sin ETA', value: bugs.filter((b) => !b.eta).length, icon: '⏳', color: 'var(--color-warning)' },
    { label: formatTodayLabel(), value: bugs.filter((b) => b.reportedAt === todayLocal()).length, icon: '📅', color: 'var(--color-success)' },
  ];

  const sensitiveMetrics = [
    { label: 'Bugs activos', value: sensitiveBugs.length, icon: '🐛', color: 'var(--color-primary)' },
    { label: 'Críticos / Alta prioridad', value: sensitiveBugs.filter((b) => b.priority === 'Highest' || b.priority === 'High').length, icon: '🔴', color: 'var(--color-danger)' },
    { label: 'Sin ETA', value: sensitiveBugs.filter((b) => !b.eta).length, icon: '⏳', color: 'var(--color-warning)' },
    { label: formatTodayLabel(), value: sensitiveBugs.filter((b) => b.reportedAt === todayLocal()).length, icon: '📅', color: 'var(--color-success)' },
  ];

  const redListMetrics = [
    { label: 'Bugs activos', value: redListBugs.length, icon: '🐛', color: 'var(--color-primary)' },
    { label: 'Críticos / Alta prioridad', value: redListBugs.filter((b) => b.priority === 'Highest' || b.priority === 'High').length, icon: '🔴', color: 'var(--color-danger)' },
    { label: 'Sin ETA', value: redListBugs.filter((b) => !b.eta).length, icon: '⏳', color: 'var(--color-warning)' },
    { label: formatTodayLabel(), value: redListBugs.filter((b) => b.reportedAt === todayLocal()).length, icon: '📅', color: 'var(--color-success)' },
  ];

  // --- Grouped for main bugs tab ---
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
      if (sortBy === 'priority') map[key] = [...list].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99));
      else if (sortBy === 'date-desc') map[key] = [...list].sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
      else if (sortBy === 'date-asc') map[key] = [...list].sort((a, b) => a.reportedAt.localeCompare(b.reportedAt));
    }
    return Object.keys(map).sort((a, b) => a.localeCompare(b)).map((key) => ({ module: key, bugs: map[key] }));
  }, [bugs, sortBy]);

  // --- Grouped for sensitive tab ---
  const sensitiveGrouped = useMemo(() => {
    const map = {};
    for (const bug of sensitiveBugs) {
      const matchingClients = (bug.affectedClients || []).filter((c) => nameSet.has(norm(c)));
      for (const client of matchingClients) {
        if (!map[client]) map[client] = [];
        if (!map[client].find((b) => b.id === bug.id)) map[client].push(bug);
      }
    }
    return Object.keys(map).sort((a, b) => a.localeCompare(b)).map((client) => ({
      client,
      bugs: map[client].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)),
      isCurrent: activeNames.has(norm(client)),
    }));
  }, [sensitiveBugs, nameSet, activeNames]);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
        <p>Cargando bugs desde Jira…</p>
      </div>
    );
  }

  const activeSensitiveCount = activeNames.size;

  const modals = (
    <>
      {selectedBug && <IssueModal issueKey={selectedBug.id} bug={selectedBug} onClose={onCloseModal} />}
      {etaBug && <ETAModal bug={etaBug} onClose={onCloseETA} onSave={onSaveETA} onDelete={onDeleteETA} />}
      {notesBug && <NotesModal bug={notesBug} user={user} onClose={onCloseNotes} onAddNote={onAddNote} onDeleteNote={onDeleteNote} onEditNote={onEditNote} />}
      {consultBug && <ConsultarETAModal bug={consultBug} moduleInfo={MODULES[consultBug.miniApps?.[0] || consultBug.module] || {}} onClose={() => setConsultBug(null)} />}
    </>
  );

  return (
    <>
      {/* Metrics — reactive to active tab */}
      <Metrics
        metrics={activeTab === 'sensitive' ? sensitiveMetrics : activeTab === 'redlist' ? redListMetrics : generalMetrics}
        loading={loading}
      />

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
        </button>
        <button
          className={`bt-main-tab${activeTab === 'redlist' ? ' active' : ''}`}
          onClick={() => setActiveTab('redlist')}
        >
          Red List
        </button>
      </div>

      {activeTab === 'sensitive' ? (
        <>
          {sensitiveClients.length === 0 ? (
            <div className="bug-list-empty">
              <span className="bug-list-empty-icon">⏳</span>
              <p>Cargando lista de clientes sensibles…</p>
            </div>
          ) : (
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
                <span className="app-bugs-count">
                  {sensitiveBugs.length} bug{sensitiveBugs.length !== 1 ? 's' : ''} en {sensitiveGrouped.length} cliente{sensitiveGrouped.length !== 1 ? 's' : ''}
                </span>
              </div>

              {sensitiveGrouped.length === 0 ? (
                <div className="bug-list-empty">
                  <span className="bug-list-empty-icon">✅</span>
                  <p>No hay bugs reportados para clientes en esta categoría.</p>
                </div>
              ) : (
                <div className="bug-list">
                  {sensitiveGrouped.map(({ client, bugs: clientBugs, isCurrent }) => {
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
                          {visible.map((bug) => (
                            <BugCard
                              key={bug.id}
                              bug={bug}
                              moduleInfo={MODULES[bug.miniApps?.[0] || bug.module] || {}}
                              onConsultETA={(b) => setConsultBug(b)}
                              onLoadETA={onOpenETA}
                              onDeleteETA={onDeleteETA}
                              onNotes={onOpenNotes}
                              onOpen={onOpenBug}
                            />
                          ))}
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
            </>
          )}
          {modals}
        </>
      ) : activeTab === 'redlist' ? (
        <>
          {redListClients.length === 0 ? (
            <div className="bug-list-empty">
              <span className="bug-list-empty-icon">⏳</span>
              <p>Cargando lista de clientes Red List…</p>
            </div>
          ) : (
            <>
              {/* Category filter */}
              <div className="sensitive-tabs">
                <button
                  className={`sensitive-tab${redListCategory === 'all' ? ' active' : ''}`}
                  onClick={() => { setRedListCategory('all'); setExpanded({}); }}
                >
                  Todos
                  <span className="sensitive-tab-count">{redListClients.length}</span>
                </button>
                {availableCategories.map((cat) => (
                  <button
                    key={cat}
                    className={`sensitive-tab${redListCategory === cat ? ' active' : ''}`}
                    onClick={() => { setRedListCategory(cat); setExpanded({}); }}
                  >
                    {cat}
                    <span className="sensitive-tab-count">{redListByCategory[cat]?.size || 0}</span>
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
                      className={`sensitive-status-pill${redListStatusFilter.includes(s) ? ' active' : ''}`}
                      onClick={() => {
                        setRedListStatusFilter((prev) =>
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
                <span className="app-bugs-count">
                  {redListBugs.length} bug{redListBugs.length !== 1 ? 's' : ''} en {redListGrouped.length} cliente{redListGrouped.length !== 1 ? 's' : ''}
                </span>
              </div>

              {redListGrouped.length === 0 ? (
                <div className="bug-list-empty">
                  <span className="bug-list-empty-icon">✅</span>
                  <p>No hay bugs reportados para clientes en esta categoría.</p>
                </div>
              ) : (
                <div className="bug-list">
                  {redListGrouped.map(({ client, category, bugs: clientBugs }) => {
                    const isExpanded = expanded[client];
                    const visible = isExpanded ? clientBugs : clientBugs.slice(0, PAGE_SIZE);
                    const remaining = clientBugs.length - PAGE_SIZE;
                    return (
                      <div key={client} className="bug-module-group">
                        <div className="bug-module-header">
                          <div className="bug-module-title">
                            <span className="bug-module-name">{client}</span>
                            <span className="bug-module-count">{clientBugs.length} bug{clientBugs.length !== 1 ? 's' : ''}</span>
                            <span className="sensitive-badge sensitive-badge--redlist">{category}</span>
                          </div>
                        </div>
                        <div className="bug-module-cards">
                          {visible.map((bug) => (
                            <BugCard
                              key={bug.id}
                              bug={bug}
                              moduleInfo={MODULES[bug.miniApps?.[0] || bug.module] || {}}
                              onConsultETA={(b) => setConsultBug(b)}
                              onLoadETA={onOpenETA}
                              onDeleteETA={onDeleteETA}
                              onNotes={onOpenNotes}
                              onOpen={onOpenBug}
                            />
                          ))}
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
            </>
          )}
          {modals}
        </>
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
          {modals}
        </>
      )}
    </>
  );
}
