import { useMemo, useState } from 'react';
import { useBugs } from '../context/BugsContext';
import { MODULES } from '../config/modules';
import BugCard from './BugCard';
import './History.css';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function toDateInputValue(iso) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export default function History() {
  const { bugs } = useBugs();

  const today = new Date();
  const defaultFrom = new Date(today.getTime() - SEVEN_DAYS_MS);

  const [module, setModule] = useState('all');
  const [from, setFrom] = useState(toDateInputValue(defaultFrom.toISOString()));
  const [to, setTo] = useState(toDateInputValue(today.toISOString()));

  const resolvedLast7 = useMemo(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    return bugs.filter(
      (b) =>
        b.status === 'Resuelto' &&
        b.resolvedAt &&
        new Date(b.resolvedAt).getTime() >= cutoff
    );
  }, [bugs]);

  const filtered = useMemo(() => {
    const fromTs = from ? new Date(from).getTime() : -Infinity;
    const toTs = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1 : Infinity;

    return resolvedLast7
      .filter((b) => (module === 'all' ? true : b.module === module))
      .filter((b) => {
        const ts = new Date(b.resolvedAt).getTime();
        return ts >= fromTs && ts <= toTs;
      })
      .sort((a, b) => new Date(b.resolvedAt) - new Date(a.resolvedAt));
  }, [resolvedLast7, module, from, to]);

  return (
    <div className="history">
      <div className="history-toolbar">
        <div className="field">
          <label htmlFor="history-module">Módulo</label>
          <select
            id="history-module"
            className="input"
            value={module}
            onChange={(e) => setModule(e.target.value)}
          >
            <option value="all">Todos</option>
            {MODULES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="history-from">Desde</label>
          <input
            id="history-from"
            type="date"
            className="input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="history-to">Hasta</label>
          <input
            id="history-to"
            type="date"
            className="input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="history-count">
          {filtered.length} bug{filtered.length !== 1 ? 's' : ''} resuelto{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="history-empty">
          No se resolvieron bugs en el rango seleccionado.
        </div>
      ) : (
        <div className="history-grid">
          {filtered.map((bug) => (
            <BugCard key={bug.id} bug={bug} variant="history" />
          ))}
        </div>
      )}
    </div>
  );
}
