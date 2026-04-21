import './Sidebar.css';

const ICONS = {
  tracker: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2l1 2h6l1-2" />
      <rect x="5" y="6" width="14" height="14" rx="6" />
      <path d="M5 12H2M22 12h-3M5 16H2M22 16h-3M5 8H2M22 8h-3" />
      <path d="M12 12v4" />
    </svg>
  ),
  report: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  ),
  history: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  kanban: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="5" height="16" rx="1" />
      <rect x="10" y="4" width="5" height="10" rx="1" />
      <rect x="17" y="4" width="4" height="13" rx="1" />
    </svg>
  ),
};

const ITEMS = [
  { key: 'tracker', label: 'Bug Tracker', icon: ICONS.tracker },
  { key: 'report', label: 'Reportar bug', icon: ICONS.report },
  { key: 'history', label: 'Historial', icon: ICONS.history },
  { key: 'kanban', label: 'Kanban', icon: ICONS.kanban },
];

export default function Sidebar({ active, onChange }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">BS</div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">BugSight</span>
          <span className="sidebar-brand-company">Humand · Soporte</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {ITEMS.map((item) => (
          <button
            key={item.key}
            className={`sidebar-item ${active === item.key ? 'sidebar-item-active' : ''}`}
            onClick={() => onChange(item.key)}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">v0.1 — panel interno</div>
    </aside>
  );
}
