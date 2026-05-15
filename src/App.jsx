import { lazy, Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import BugTracker from './components/BugTracker';
import { useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
import { fetchActiveBugs } from './utils/jira';
import './App.css';

const Insights = lazy(() => import('./pages/Insights'));

const DEFAULT_FILTERS = {
  etaFilter: 'all',
  statuses: [],
  priorities: [],
  search: '',
  dateFrom: '',
  dateTo: '',
};

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTodayLabel() {
  const d = new Date();
  return `Reportados hoy (${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')})`;
}

function BugTrackerMetrics({ bugs, loading }) {
  const total = bugs.length;
  const critical = bugs.filter((b) => b.priority === 'Highest' || b.priority === 'High').length;
  const sinEta = bugs.filter((b) => !b.eta).length;
  const hoy = bugs.filter((b) => b.reportedAt === todayLocal()).length;

  const metrics = [
    { label: 'Bugs activos', value: total, icon: '🐛', color: 'var(--color-primary)' },
    { label: 'Críticos / Alta prioridad', value: critical, icon: '🔴', color: 'var(--color-danger)' },
    { label: 'Sin ETA', value: sinEta, icon: '⏳', color: 'var(--color-warning)' },
    { label: formatTodayLabel(), value: hoy, icon: '📅', color: 'var(--color-success)' },
  ];

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

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedBug, setSelectedBug] = useState(null);
  const [etaBug, setEtaBug] = useState(null);
  const [notesBug, setNotesBug] = useState(null);
  const [activeSection, setActiveSection] = useState('bug-tracker');
  const [sortBy, setSortBy] = useState('priority');

  async function loadData(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [jiraBugs, notesRes, etaRes] = await Promise.all([
        fetchActiveBugs(),
        supabase.from('notes').select('*').order('created_at'),
        supabase.from('eta_overrides').select('*'),
      ]);
      const notes = notesRes.data || [];
      const etas = etaRes.data || [];
      setBugs(
        jiraBugs.map((b) => ({
          ...b,
          eta: b.eta || etas.find((e) => e.bug_id === b.id)?.eta_date || null,
          notes: notes.filter((n) => n.bug_id === b.id),
        })),
      );
    } catch (err) {
      console.error('Error cargando datos:', err);
      setLoadError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 5 * 60 * 1000); // auto-refresh every 5 min
    return () => clearInterval(interval);
  }, []);

  // Real-time notes via Supabase
  useEffect(() => {
    const channel = supabase.channel('notes-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes' }, ({ new: n }) => {
        setBugs((prev) => prev.map((b) => {
          if (b.id !== n.bug_id || b.notes.some((x) => x.id === n.id)) return b;
          const updated = { ...b, notes: [...b.notes, n] };
          setNotesBug((cur) => cur?.id === n.bug_id ? updated : cur);
          return updated;
        }));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notes' }, ({ new: n }) => {
        setBugs((prev) => prev.map((b) => {
          if (b.id !== n.bug_id) return b;
          const updated = { ...b, notes: b.notes.map((x) => x.id === n.id ? n : x) };
          setNotesBug((cur) => cur?.id === n.bug_id ? updated : cur);
          return updated;
        }));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notes' }, ({ old: n }) => {
        setBugs((prev) => prev.map((b) => {
          if (!b.notes.some((x) => x.id === n.id)) return b;
          const updated = { ...b, notes: b.notes.filter((x) => x.id !== n.id) };
          setNotesBug((cur) => cur?.id === b.id ? updated : cur);
          return updated;
        }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredBugs = useMemo(() => {
    const norm = (s) => s?.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() ?? '';
    let result = bugs;
    if (filters.etaFilter === 'sin-eta') result = result.filter((b) => !b.eta);
    if (filters.etaFilter === 'con-eta') result = result.filter((b) => !!b.eta);
    if (filters.statuses.length) {
      result = result.filter((b) => filters.statuses.includes(b.status));
    } else {
      result = result.filter((b) => b.status !== 'Closed' && b.status !== 'Released');
    }
    if (filters.priorities.length) result = result.filter((b) => filters.priorities.includes(b.priority));
    if (filters.search.trim()) {
      const q = norm(filters.search.trim());
      result = result.filter((b) =>
        norm(b.title).includes(q) || b.id.toLowerCase().includes(q) || norm(b.module).includes(q) ||
        (b.affectedClients || []).some((c) => norm(c).includes(q)),
      );
    }
    if (filters.dateFrom) result = result.filter((b) => b.reportedAt >= filters.dateFrom);
    if (filters.dateTo) result = result.filter((b) => b.reportedAt <= filters.dateTo);
    return result;
  }, [bugs, filters]);

  async function handleDeleteETA(bugId) {
    await supabase.from('eta_overrides').delete().eq('bug_id', bugId);
    setBugs((prev) => prev.map((b) => b.id === bugId ? { ...b, eta: null } : b));
    setEtaBug(null);
  }

  async function handleSaveETA(bugId, date) {
    const { error } = await supabase.from('eta_overrides').upsert(
      { bug_id: bugId, eta_date: date, set_by: user?.name || 'Usuario' },
      { onConflict: 'bug_id' },
    );
    if (error) throw new Error(error.message);
    setBugs((prev) => prev.map((b) => b.id === bugId ? { ...b, eta: date } : b));
  }

  function handleOpenBug(bug) {
    setSelectedBug(bugs.find((b) => b.id === bug.id) || bug);
  }

  function handleAddNote(bugId, note) {
    setBugs((prev) => prev.map((b) => {
      if (b.id !== bugId) return b;
      const updated = { ...b, notes: [...b.notes, note] };
      setNotesBug(updated);
      return updated;
    }));
  }

  function handleDeleteNote(bugId, noteId) {
    setBugs((prev) => prev.map((b) => {
      if (b.id !== bugId) return b;
      const updated = { ...b, notes: b.notes.filter((n) => n.id !== noteId) };
      setNotesBug(updated);
      return updated;
    }));
  }

  function handleEditNote(bugId, noteId, text) {
    setBugs((prev) => prev.map((b) => {
      if (b.id !== bugId) return b;
      const updated = { ...b, notes: b.notes.map((n) => n.id === noteId ? { ...n, text } : n) };
      setNotesBug(updated);
      return updated;
    }));
  }

  return (
    <div className="app-layout">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        user={user}
        onLogout={logout}
      />
      <main className="app-main">
        {activeSection === 'insights' ? (
          <Suspense fallback={<div className="app-loading"><div className="app-loading-spinner" /><p>Cargando Insights…</p></div>}>
            <Insights bugs={bugs} onRefresh={() => loadData(true)} refreshing={refreshing} />
          </Suspense>
        ) : (
          <>
            <div className="app-page-header">
              <div>
                <h1 className="app-page-title">Bug Tracker</h1>
                <p className="app-page-subtitle">Monitoreá bugs por módulo, filtrá por estado y consultá ETAs a los PMs.</p>
              </div>
              <button
                className="btn-refresh"
                onClick={() => loadData(true)}
                disabled={refreshing}
                title="Actualizar desde Jira"
              >
                <span className={refreshing ? 'spin' : ''}>↻</span>
              </button>
            </div>
            <div className="app-content">
              {loadError && (
                <div style={{ background: '#fff0f0', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius)', padding: '12px 16px', color: 'var(--color-danger)', fontSize: 13 }}>
                  ⚠️ Error cargando bugs desde Jira: <strong>{loadError}</strong>
                  <button onClick={() => { setLoadError(null); loadData(true); }} style={{ marginLeft: 12, color: 'var(--color-danger)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
                </div>
              )}
              <BugTrackerMetrics bugs={filteredBugs} loading={loading} />
              <BugTracker
                bugs={filteredBugs}
                loading={loading}
                filters={filters}
                onFiltersChange={setFilters}
                sortBy={sortBy}
                onSortChange={setSortBy}
                onRefresh={() => loadData(true)}
                refreshing={refreshing}
                selectedBug={selectedBug}
                etaBug={etaBug}
                notesBug={notesBug}
                onOpenBug={handleOpenBug}
                onCloseModal={() => setSelectedBug(null)}
                onOpenETA={(bug) => setEtaBug(bug)}
                onCloseETA={() => setEtaBug(null)}
                onSaveETA={handleSaveETA}
                onDeleteETA={handleDeleteETA}
                onOpenNotes={(bug) => setNotesBug(bugs.find((b) => b.id === bug.id) || bug)}
                onCloseNotes={() => setNotesBug(null)}
                onAddNote={handleAddNote}
                onDeleteNote={handleDeleteNote}
                onEditNote={handleEditNote}
                user={user}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  );
}
