import './Sidebar.css';

const NAV_ITEMS = [
  { id: 'bug-tracker', label: 'Bug Tracker', icon: '🐛', active: true },
  { id: 'insights', label: 'Insights', icon: '📊', active: true },
  { id: 'report-bug', label: 'Reportar bug', icon: '➕', active: false, soon: true },
  { id: 'history', label: 'Historial', icon: '📋', active: false, soon: true },
  { id: 'kanban', label: 'Kanban', icon: '🗂', active: false, soon: true },
];

export default function Sidebar({ activeSection, onSectionChange, user, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🐞</div>
        <span className="sidebar-logo-name">BugSight</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`sidebar-nav-item ${activeSection === item.id ? 'active' : ''} ${item.soon ? 'soon' : ''}`}
            onClick={() => !item.soon && onSectionChange(item.id)}
            disabled={item.soon}
            title={item.soon ? 'Próximamente' : item.label}
          >
            <span className="sidebar-nav-icon">{item.icon}</span>
            <span className="sidebar-nav-label">{item.label}</span>
            {item.soon && <span className="sidebar-soon-badge">Pronto</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{user.name.charAt(0).toUpperCase()}</div>
            <span className="sidebar-user-name" title={user.email}>{user.name}</span>
          </div>
        )}
        <button className="sidebar-logout-btn" onClick={onLogout}>
          <span>⎋</span> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
