// Full list of product modules. Used in the module dropdown and filters.
export const MODULES = [
  'Acknowledgements',
  'Anniversaries',
  'Automations',
  'ATS',
  'Auth',
  'Calls',
  'ChatBots',
  'Chats',
  'Core Forms',
  'Documents',
  'Emp Lifecycle',
  'Events',
  'Feed',
  'Files',
  'Forms',
  'Goals',
  'Groups',
  'Insights',
  'Integrations',
  'Learning',
  'Libraries',
  'Livestream',
  'Marketplace',
  'News',
  'Notifications',
  'Onboarding',
  'Org Chart',
  'People Exp',
  'Perf Review',
  'Prode',
  'Profile',
  'Referrals',
  'Region/Sites',
  'Roles/Perm',
  'Sammy',
  'Schedules',
  'Service Mgmt',
  'Surveys',
  'Time Off',
  'Time Tracking',
  'Trainings',
  'Users',
  'Widgets',
  'Workflows',
  'General',
  'Internal',
];

// PM responsible per module. Extend as needed.
// The slack handle is used when sending ETA messages via Slack API.
export const MODULE_PMS = {
  Feed: { pm: 'Lucas Fernández', slack: '@lucas.fernandez' },
  Notifications: { pm: 'Sofía Martínez', slack: '@sofia.martinez' },
  Goals: { pm: 'Martín Díaz', slack: '@martin.diaz' },
  News: { pm: 'Andrea López', slack: '@andrea.lopez' },
  Chats: { pm: 'Lucas Fernández', slack: '@lucas.fernandez' },
};

export const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

export const STATUSES = ['Parking Lot', 'Backlog', 'Developing', 'Resuelto'];

export function getPMForModule(module) {
  return MODULE_PMS[module] || { pm: 'Sin asignar', slack: '' };
}
