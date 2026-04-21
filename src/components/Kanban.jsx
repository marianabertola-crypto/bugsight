import { useMemo, useState } from 'react';
import { useBugs } from '../context/BugsContext';
import BugCard from './BugCard';
import './Kanban.css';

const COLUMNS = [
  { key: 'Parking Lot', label: 'Parking Lot' },
  { key: 'Backlog', label: 'Backlog' },
  { key: 'Developing', label: 'Developing' },
  { key: 'Resuelto', label: 'Resuelto' },
];

export default function Kanban() {
  const { bugs, updateBug } = useBugs();
  const [dragOverCol, setDragOverCol] = useState(null);

  const bugsByColumn = useMemo(() => {
    const groups = Object.fromEntries(COLUMNS.map((c) => [c.key, []]));
    bugs.forEach((bug) => {
      if (groups[bug.status]) groups[bug.status].push(bug);
    });
    return groups;
  }, [bugs]);

  function onDragStart(e, bug) {
    e.dataTransfer.setData('text/plain', bug.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e, colKey) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colKey) setDragOverCol(colKey);
  }

  function onDragLeave() {
    setDragOverCol(null);
  }

  function onDrop(e, colKey) {
    e.preventDefault();
    setDragOverCol(null);
    const bugId = e.dataTransfer.getData('text/plain');
    if (!bugId) return;

    const bug = bugs.find((b) => b.id === bugId);
    if (!bug || bug.status === colKey) return;

    const patch = { status: colKey };
    if (colKey === 'Resuelto') patch.resolvedAt = new Date().toISOString();
    else if (bug.status === 'Resuelto') patch.resolvedAt = null;

    // TODO(API) — NOT EXECUTED IN THIS VERSION.
    // This version intentionally does NOT mutate anything in Jira.
    // The status change is applied only to local state for demo purposes.
    // When wiring the real integration:
    //   1. GET /rest/api/3/issue/${bugId}/transitions to list available transitions.
    //   2. PUT /rest/api/3/issue/${bugId}/transitions with the transition id that maps
    //      to the target column (`colKey`), authenticated with the Jira PAT.
    //   3. Only apply the local `updateBug` update after the API responds with 2xx.
    updateBug(bugId, patch);
  }

  return (
    <div className="kanban">
      {COLUMNS.map((col) => {
        const items = bugsByColumn[col.key] || [];
        return (
          <div
            key={col.key}
            className={`kanban-col ${dragOverCol === col.key ? 'kanban-col-over' : ''}`}
            onDragOver={(e) => onDragOver(e, col.key)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, col.key)}
          >
            <header className="kanban-col-header">
              <span className={`kanban-col-dot kanban-col-dot-${col.key.replace(/\s+/g, '-').toLowerCase()}`} />
              <h3>{col.label}</h3>
              <span className="kanban-col-count">{items.length}</span>
            </header>
            <div className="kanban-col-body">
              {items.length === 0 && (
                <div className="kanban-col-empty">Sin bugs</div>
              )}
              {items.map((bug) => (
                <BugCard
                  key={bug.id}
                  bug={bug}
                  variant="kanban"
                  draggable
                  onDragStart={(e) => onDragStart(e, bug)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
