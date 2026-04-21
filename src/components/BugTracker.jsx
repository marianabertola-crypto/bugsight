import { useMemo, useState } from 'react';
import { useBugs } from '../context/BugsContext';
import { MODULES, getPMForModule } from '../config/modules';
import BugCard from './BugCard';
import MetricsBar from './MetricsBar';
import ETAModal from './ETAModal';
import NotesModal from './NotesModal';
import './BugTracker.css';

const FILTER_CHIPS = [
  { key: 'all', label: 'Todos' },
  { key: 'no-eta', label: 'Sin ETA' },
  { key: 'today', label: 'Hoy' },
  { key: 'Parking Lot', label: 'Parking Lot' },
  { key: 'Backlog', label: 'Backlog' },
  { key: 'Developing', label: 'Developing' },
  { key: 'Highest', label: 'Highest' },
  { key: 'High', label: 'High' },
  { key: 'Medium', label: 'Medium' },
];

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

export default function BugTracker() {
  const { bugs, logETARequest, addNote } = useBugs();
  const [module, setModule] = useState('all');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [etaBug, setEtaBug] = useState(null);
  const [notesBug, setNotesBug] = useState(null);

  const filteredBugs = useMemo(() => {
    return bugs.filter((b) => {
      if (b.status === 'Resuelto') return false;
      if (module !== 'all' && b.module !== module) return false;
      if (
        search &&
        !b.title.toLowerCase().includes(search.toLowerCase()) &&
        !b.id.toLowerCase().includes(search.toLowerCase())
      )
        return false;

      switch (filter) {
        case 'all':
          return true;
        case 'no-eta':
          return !b.eta;
        case 'today':
          return isToday(b.reportedAt);
        case 'Parking Lot':
        case 'Backlog':
        case 'Developing':
          return b.status === filter;
        case 'Highest':
        case 'High':
        case 'Medium':
          return b.priority === filter;
        default:
          return true;
      }
    });
  }, [bugs, module, search, filter]);

  const metrics = useMemo(
    () => [
      { label: 'Bugs abiertos', value: filteredBugs.length },
      {
        label: 'Sin ETA',
        value: filteredBugs.filter((b) => !b.eta).length,
      },
      {
        label: 'Prioridad Highest',
        value: filteredBugs.filter((b) => b.priority === 'Highest').length,
      },
      {
        label: 'Reportados hoy',
        value: filteredBugs.filter((b) => isToday(b.reportedAt)).length,
      },
    ],
    [filteredBugs]
  );

  const grouped = useMemo(() => {
    const map = new Map();
    filteredBugs.forEach((bug) => {
      if (!map.has(bug.module)) map.set(bug.module, []);
      map.get(bug.module).push(bug);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredBugs]);

  function handleConfirmETA(bugId) {
    logETARequest(bugId);
  }

  // Bugs panel after filters are applied, grouped by module.
  return (
    <div className="tracker">
      <div className="tracker-toolbar">
        <div className="toolbar-row">
          <select
            className="input"
            value={module}
            onChange={(e) => setModule(e.target.value)}
          >
            <option value="all">Todos los módulos</option>
            {MODULES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Buscar por título o ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="toolbar-chips">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.key}
              className={`chip ${filter === chip.key ? 'chip-active' : ''}`}
              onClick={() => setFilter(chip.key)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <MetricsBar metrics={metrics} />

      {grouped.length === 0 ? (
        <div className="tracker-empty">
          No hay bugs que coincidan con los filtros seleccionados.
        </div>
      ) : (
        <div className="tracker-groups">
          {grouped.map(([mod, items]) => {
            const pm = getPMForModule(mod);
            return (
              <section key={mod} className="tracker-group">
                <header className="tracker-group-header">
                  <div>
                    <h2 className="tracker-group-title">{mod}</h2>
                    <p className="tracker-group-pm">
                      PM: <strong>{pm.pm}</strong> {pm.slack && <span>· {pm.slack}</span>}
                    </p>
                  </div>
                  <span className="tracker-group-count">{items.length} bug{items.length !== 1 ? 's' : ''}</span>
                </header>

                <div className="tracker-group-grid">
                  {items.map((bug) => (
                    <BugCard
                      key={bug.id}
                      bug={bug}
                      variant="tracker"
                      onRequestETA={setEtaBug}
                      onOpenNotes={setNotesBug}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {etaBug && (
        <ETAModal
          bug={etaBug}
          onClose={() => setEtaBug(null)}
          onConfirm={handleConfirmETA}
        />
      )}

      {notesBug && (
        <NotesModal
          bug={bugs.find((b) => b.id === notesBug.id) || notesBug}
          onClose={() => setNotesBug(null)}
          onAddNote={addNote}
        />
      )}
    </div>
  );
}
