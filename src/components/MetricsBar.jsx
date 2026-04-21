import './MetricsBar.css';

export default function MetricsBar({ metrics }) {
  return (
    <div className="metrics-bar">
      {metrics.map((m) => (
        <div key={m.label} className="metric-card">
          <span className="metric-label">{m.label}</span>
          <span className="metric-value">{m.value}</span>
        </div>
      ))}
    </div>
  );
}
