import './StatusBadge.css';

const CLASS_MAP = {
  'Parking Lot': 'status-parking',
  Backlog: 'status-backlog',
  Developing: 'status-developing',
  Resuelto: 'status-resolved',
};

export default function StatusBadge({ status }) {
  const className = CLASS_MAP[status] || 'status-backlog';
  return <span className={`status-badge ${className}`}>{status}</span>;
}
