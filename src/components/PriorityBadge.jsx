import './PriorityBadge.css';

const CLASS_MAP = {
  Highest: 'priority-highest',
  High: 'priority-high',
  Medium: 'priority-medium',
  Low: 'priority-low',
  Lowest: 'priority-lowest',
};

export default function PriorityBadge({ priority }) {
  const className = CLASS_MAP[priority] || 'priority-lowest';
  return <span className={`priority-badge ${className}`}>{priority}</span>;
}
