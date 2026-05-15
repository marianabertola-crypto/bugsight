import { MODULES, MODULE_NAMES } from '../config/modules';

const STATUS_MAP = {
  'PARKING LOT': 'Parking Lot',
  BACKLOG: 'Backlog',
  DISCOVERY: 'Discovery',
  'FOR DEVELOPMENT': 'For Development',
  DEVELOPING: 'Developing',
  Developed: 'Developed',
  STAGING: 'Staging',
  CLOSED: 'Closed',
  RELEASED: 'Released',
};

const MODULE_ALIASES = {
  px: 'People Exp',
  'perf rev': 'Perf Review',
  'perf review': 'Perf Review',
  'service mgmt': 'Service Mgmt',
  sm: 'Service Mgmt',
  notif: 'Notification Center',
  'notificacion center': 'Notification Center',
  notification: 'Notification Center',
  'org chart': 'Org Chart',
  'time off': 'Time Off',
  'time tracking': 'Time Tracking',
  tt: 'Time Tracking',
  kiosk: 'Time Tracking',
  docs: 'Documents',
  document: 'Documents',
  chat: 'Chats',
  'chats 2': 'Chats',
  feed: 'Feed',
  profile: 'Profile',
  users: 'Users',
  schedules: 'Schedules',
  surveys: 'Surveys',
  goals: 'Goals',
  groups: 'Groups',
  events: 'Events',
  forms: 'Forms',
  files: 'Files',
  sammy: 'Sammy',
  learning: 'Learning',
  trainings: 'Trainings',
  onboarding: 'Onboarding',
};

function normalizeModule(raw) {
  if (!raw || raw.startsWith('[')) return null;
  if (MODULE_ALIASES[raw]) return MODULE_ALIASES[raw];
  const exact = MODULE_NAMES.find((m) => m.toLowerCase() === raw);
  if (exact) return exact;
  return (
    MODULE_NAMES.find(
      (m) => m.toLowerCase().includes(raw) || raw.startsWith(m.toLowerCase()),
    ) || null
  );
}

function extractModuleFromCustomField(field) {
  if (!field?.length) return null;
  const first = field[0];
  const value = typeof first === 'string' ? first : first?.value;
  if (!value) return null;
  return Object.keys(MODULES).includes(value) ? value : normalizeModule(value.toLowerCase()) || value;
}

function extractModuleFromTitle(title) {
  const bracketMatch = title.match(/^(?:\[[^\]]+\]\s*)?([^|]+?)\s*\|/);
  if (bracketMatch) {
    const m = normalizeModule(bracketMatch[1].trim().toLowerCase());
    if (m) return m;
  }
  const prefixMatch = title.match(/^\[([^\]]+)\]/);
  if (prefixMatch) {
    const m = normalizeModule(prefixMatch[1].trim().toLowerCase());
    if (m) return m;
  }
  return 'General';
}

function extractEtaFromFixVersions(fixVersions) {
  if (!fixVersions?.length) return null;
  for (const v of fixVersions) {
    const match = v.name?.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return null;
}

export function mapJiraIssue(issue) {
  const fields = issue.fields;
  const status = STATUS_MAP[fields.status.name] || fields.status.name;
  const miniAppsField = fields.customfield_10071;
  const miniApps = miniAppsField
    ? miniAppsField.map((i) => (typeof i === 'string' ? i : i?.value)).filter(Boolean)
    : [];

  return {
    id: issue.key,
    title: fields.summary,
    status,
    priority: fields.priority.name,
    module: extractModuleFromCustomField(miniAppsField) || extractModuleFromTitle(fields.summary),
    miniApps,
    affectedClients: Array.isArray(fields.customfield_10046)
      ? fields.customfield_10046.filter(Boolean)
      : [],
    affectedClientsSize: fields.customfield_10109?.value || null,
    eta: extractEtaFromFixVersions(fields.fixVersions),
    etaConsultations: 0,
    reportedAt: fields.created.split('T')[0],
    notes: [],
  };
}

async function fetchAllPages(jql, fields) {
  const allIssues = [];
  const seen = new Set();
  const maxResults = 100;
  let nextPageToken = undefined;
  let page = 0;

  for (;;) {
    page++;
    const params = new URLSearchParams({ jql, fields, maxResults });
    if (nextPageToken) params.set('nextPageToken', nextPageToken);

    const res = await fetch(`/api/jira-search?${params}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jira API error: ${res.status} - ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const issues = data.issues ?? [];

    // Log what Jira returns to help debug total count
    if (page === 1) {
      console.log(`[Jira] total reported by API: ${data.total ?? 'n/a'}, fetching all pages...`);
    }

    for (const issue of issues) {
      if (!seen.has(issue.key)) {
        seen.add(issue.key);
        allIssues.push(issue);
      }
    }

    if (!data.nextPageToken) {
      console.log(`[Jira] done. Pages fetched: ${page}, total issues loaded: ${allIssues.length}`);
      break;
    }
    nextPageToken = data.nextPageToken;
  }

  return allIssues;
}

export async function fetchActiveBugs() {
  const jql =
    'issuetype = Bug AND project != HUREP AND created >= "2025-04-01" ORDER BY created ASC';
  const fields =
    'summary,status,priority,created,fixVersions,customfield_10071,customfield_10046,customfield_10109';

  const issues = await fetchAllPages(jql, fields);
  return issues.map(mapJiraIssue);
}

export async function fetchClosedBugs() {
  const jql =
    'issuetype = Bug AND project != HUREP AND created >= "2025-04-01" AND status IN (CLOSED, RELEASED) ORDER BY created ASC';
  const fields = 'summary,status,created,resolutiondate,customfield_10071,customfield_10046';

  const issues = await fetchAllPages(jql, fields);
  return issues.map((issue) => {
    const f = issue.fields;
    const miniAppsField = f.customfield_10071;
    const miniApps = miniAppsField
      ? miniAppsField.map((i) => (typeof i === 'string' ? i : i?.value)).filter(Boolean)
      : [];
    return {
      id: issue.key,
      title: f.summary,
      status: STATUS_MAP[f.status.name] || f.status.name,
      module: extractModuleFromCustomField(miniAppsField) || extractModuleFromTitle(f.summary),
      miniApps,
      affectedClients: Array.isArray(f.customfield_10046) ? f.customfield_10046.filter(Boolean) : [],
      reportedAt: f.created.split('T')[0],
      resolvedAt: f.resolutiondate ? f.resolutiondate.split('T')[0] : null,
    };
  });
}
