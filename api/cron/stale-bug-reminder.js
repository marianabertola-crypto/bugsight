// Vercel Cron Job — runs daily at 12:00 Argentina time (15:00 UTC)
// For each open bug of a sensitive/redlist client stagnant for 7+ days,
// sends one Slack message to the module's PM asking for an update.
// One reminder per stagnation period: timer resets when status changes.
//
// Required env vars: JIRA_EMAIL, JIRA_TOKEN, SENSITIVE_CLIENTS_URL,
//                    SLACK_BOT_TOKEN, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

const JIRA_BASE_URL = 'https://humand.atlassian.net';
const SLACK_CHANNEL = 'product-etas-test';
const STAGNANT_DAYS = 1; // TEST: revertir a 7 antes de deployar a producción

const MODULES = {
  Acknowledgements: { pm: 'Delfina Pipan', slackId: 'U067SMZ18KB' },
  Anniversaries: { pm: 'Barbara Aliprandi', slackId: 'U05TC8QBX39' },
  Automations: { pm: 'Martin Ciccioli', slackId: 'U02SEQUGJ78' },
  ATS: { pm: 'Manuela Cavallo', slackId: 'U08N6R7G03U' },
  Auth: { pm: 'Agustina Ini', slackId: 'U05TRT1BS78' },
  Calls: { pm: 'Fermin Castro Madero', slackId: 'U06RUNGDN0Y' },
  ChatBots: { pm: 'Cristian Baltazar', slackId: 'U05ASJS4F1S' },
  Chats: { pm: 'Luciano Paradiso', slackId: 'U05FFDZ4CQH' },
  Events: { pm: 'Carolina Arditi', slackId: 'U05R2440NN5' },
  Feed: { pm: 'Barbara Aliprandi', slackId: 'U05TC8QBX39' },
  Forms: { pm: 'Carolina Arditi', slackId: 'U05R2440NN5' },
  Goals: { pm: 'Cristian Baltazar', slackId: 'U05ASJS4F1S' },
  Groups: { pm: 'Barbara Aliprandi', slackId: 'U05TC8QBX39' },
  Learning: { pm: 'Delfina Pipan', slackId: 'U067SMZ18KB' },
  Libraries: { pm: 'Delfina Pipan', slackId: 'U067SMZ18KB' },
  Livestream: { pm: 'Fermin Castro Madero', slackId: 'U06RUNGDN0Y' },
  Marketplace: { pm: 'Barbara Aliprandi', slackId: 'U05TC8QBX39' },
  News: { pm: 'Barbara Aliprandi', slackId: 'U05TC8QBX39' },
  'Notification Center': { pm: 'Cristian Baltazar', slackId: 'U05ASJS4F1S' },
  Onboarding: { pm: 'Juan Diego Alcocer', slackId: 'U06T3HRA1EZ' },
  'Org Chart': { pm: 'Delfina Pipan', slackId: 'U067SMZ18KB' },
  Recognitions: { pm: 'Barbara Aliprandi', slackId: 'U05TC8QBX39' },
  Trainings: { pm: 'Delfina Pipan', slackId: 'U067SMZ18KB' },
  Users: { pm: 'Agustina Ini', slackId: 'U05TRT1BS78' },
  Workflows: { pm: 'Martin Ciccioli', slackId: 'U02SEQUGJ78' },
};

// ── Normalization (same as alert-redlist) ─────────────────────────────────────

function norm(s) {
  return s?.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim() ?? '';
}

const RL_NOISE_WORDS = [
  'new deal', 'new business', 'inbound', 'via calendly', 'migrated deal',
  'cx referred deal', 'from wp', 'solo comunicacion', 'anos contrato',
  'referred deal', 'billing partner', 'prode 2026', 'prode2026',
];

function normForRedList(s) {
  if (!s) return '';
  let v = s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\[.*?\]\s*/g, '')
    .replace(/\s*[-–]\s*(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|january|february|march|april|may|june|july|august|september|october|november|december)\s*\d{4}/gi, '')
    .replace(/\s*[-–]\s*\d{4}/g, '')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase();
  for (const w of RL_NOISE_WORDS) {
    v = v.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
  }
  return v.replace(/[.\s,()°'"\/\-–#@!]/g, '').trim();
}

function matchesRedListName(jiraClient, redListNorm) {
  return normForRedList(jiraClient) === redListNorm;
}

// ── Module extraction ─────────────────────────────────────────────────────────

function extractModule(miniAppsField, title) {
  if (miniAppsField?.length) {
    const first = miniAppsField[0];
    const value = typeof first === 'string' ? first : first?.value;
    if (value) {
      if (MODULES[value]) return value;
      const found = Object.keys(MODULES).find((m) => m.toLowerCase() === value.toLowerCase());
      if (found) return found;
    }
  }
  const bracketMatch = title?.match(/^(?:\[[^\]]+\]\s*)?([^|]+?)\s*\|/);
  if (bracketMatch) {
    const candidate = bracketMatch[1].trim();
    const found = Object.keys(MODULES).find((m) => m.toLowerCase() === candidate.toLowerCase());
    if (found) return found;
  }
  return 'General';
}

// ── Jira ──────────────────────────────────────────────────────────────────────

function getCredentials() {
  const { JIRA_EMAIL, JIRA_TOKEN } = process.env;
  return Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');
}

function mapIssue(issue) {
  const f = issue.fields;
  const affectedClients = Array.isArray(f.customfield_10046)
    ? f.customfield_10046.map((c) => (typeof c === 'string' ? c : c?.value)).filter(Boolean)
    : [];
  return {
    id: issue.key,
    title: f.summary,
    status: f.status?.name || 'Unknown',
    created: f.created,
    module: extractModule(f.customfield_10071, f.summary),
    affectedClients,
  };
}

// Fetch ALL open bugs whose status hasn't changed in STAGNANT_DAYS, with pagination
async function fetchStaleBugs() {
  const credentials = getCredentials();
  const jql = `issuetype = Bug AND project != HUREP AND status not in (Closed, Released, Done) AND status changed before "-${STAGNANT_DAYS}d" ORDER BY created ASC`;
  const fields = 'summary,status,created,customfield_10071,customfield_10046';
  const pageSize = 100;
  const allIssues = [];
  let startAt = 0;

  while (true) {
    const params = new URLSearchParams({ jql, fields, maxResults: pageSize, startAt });
    const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/search/jql?${params}`, {
      headers: { Authorization: `Basic ${credentials}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Jira search error: ${res.status}`);
    const data = await res.json();
    const issues = data.issues || [];
    allIssues.push(...issues);
    if (startAt + issues.length >= (data.total || 0) || issues.length < pageSize) break;
    startAt += pageSize;
  }

  return allIssues.map(mapIssue);
}

// Returns the "stagnation start" timestamp: MAX(lastStatusChange, firstSensitiveClientAdded).
// - lastStatusChange: most recent status change (or bugCreated if never changed)
// - firstSensitiveClientAdded: earliest time any of sensitiveClientsLower appeared in the
//   affectedClients field (or bugCreated if the client was there from creation)
// Using the MAX ensures: if a sensitive client was added AFTER the last status change,
// the 7-day clock starts from when the client was added, not the older status change.
async function getStagnationStart(bugId, bugCreated, sensitiveClientsLower) {
  const credentials = getCredentials();
  const url = `${JIRA_BASE_URL}/rest/api/3/issue/${bugId}/changelog?orderBy=-created&maxResults=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${credentials}`, Accept: 'application/json' },
  });
  if (!res.ok) return new Date(bugCreated);

  const data = await res.json();
  const entries = data.values || [];

  let lastStatusChange = null;   // first match in desc order = most recent
  let firstSensitiveAdded = null; // last match in desc order = oldest / earliest

  for (const history of entries) {
    const historyTime = new Date(history.created);

    for (const item of (history.items || [])) {
      // Most recent status change (entries are desc — take first hit only)
      if ((item.field === 'status' || item.fieldId === 'status') && !lastStatusChange) {
        lastStatusChange = historyTime;
      }

      // Sensitive client additions — keep updating to get the EARLIEST one
      const isAffectedField =
        item.fieldId === 'customfield_10046' ||
        (item.field || '').toLowerCase().includes('affected client');
      if (isAffectedField) {
        const toList = (item.toString || '').split(',').map((v) => normForRedList(v));
        const fromList = (item.fromString || '').split(',').map((v) => normForRedList(v));
        const clientNorms = sensitiveClientsLower.map((c) => normForRedList(c));
        const addedSensitive = clientNorms.some(
          (c) => toList.includes(c) && !fromList.includes(c)
        );
        if (addedSensitive) firstSensitiveAdded = historyTime; // overwrite → ends up as earliest
      }
    }
  }

  const createdDate = new Date(bugCreated);
  const statusStart = lastStatusChange ?? createdDate;
  const sensitiveStart = firstSensitiveAdded ?? createdDate;

  // Stagnation period starts from whichever happened most recently
  return statusStart > sensitiveStart ? statusStart : sensitiveStart;
}

// ── Google Sheets ─────────────────────────────────────────────────────────────

async function fetchClients(type) {
  const { SENSITIVE_CLIENTS_URL } = process.env;
  if (!SENSITIVE_CLIENTS_URL) return [];
  try {
    const res = await fetch(`${SENSITIVE_CLIENTS_URL}?type=${type}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// ── Supabase ──────────────────────────────────────────────────────────────────

function supabaseHeaders() {
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

// Returns true if a reminder was already sent for this exact stagnation period.
// Key: (bug_id, status_since ISO string) — resets automatically when status changes.
async function isAlreadyReminded(bugId, statusSince) {
  const sinceStr = statusSince.toISOString();
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/stale_reminders?bug_id=eq.${encodeURIComponent(bugId)}&status_since=eq.${encodeURIComponent(sinceStr)}&select=bug_id`;
  const res = await fetch(url, { headers: supabaseHeaders() });
  const data = await res.json();
  return Array.isArray(data) && data.length > 0;
}

async function recordReminder(bugId, statusSince, bugStatus) {
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/stale_reminders`;
  await fetch(url, {
    method: 'POST',
    headers: { ...supabaseHeaders(), Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({
      bug_id: bugId,
      status_since: statusSince.toISOString(),
      bug_status: bugStatus,
    }),
  });
}

// ── Slack ─────────────────────────────────────────────────────────────────────

async function sendSlackMessage(text) {
  const { SLACK_BOT_TOKEN } = process.env;
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    body: JSON.stringify({ channel: SLACK_CHANNEL, text }),
  });
  const data = await res.json();
  if (!data.ok) console.error('[Slack]', data.error);
  return data.ok;
}

function buildReminderMessage(bug, matchedClients, daysSinceChange) {
  const moduleInfo = MODULES[bug.module] || {};
  const pmMention = moduleInfo.slackId
    ? `<@${moduleInfo.slackId}>`
    : moduleInfo.pm || 'Sin PM asignado';
  const jiraUrl = `${JIRA_BASE_URL}/browse/${bug.id}`;
  const clientList = matchedClients.join(', ');

  return [
    `:hourglass_flowing_sand: *Update pendiente — bug de cliente en churn risk*`,
    `*Bug:* <${jiraUrl}|${bug.id} ${bug.title}>`,
    `*Estado actual:* ${bug.status} — sin cambios hace *${daysSinceChange} días*`,
    `*Cliente${matchedClients.length > 1 ? 's' : ''}:* ${clientList}`,
    `*Módulo:* ${bug.module} — PM: ${pmMention}`,
    `¿Podrías compartirnos una actualización de esta card, por favor? :pray::skin-tone-2:`,
  ].join('\n');
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const [staleBugs, sensitiveClients, redListClients] = await Promise.all([
      fetchStaleBugs(),
      fetchClients('sensitive'),
      fetchClients('redlist'),
    ]);

    // Use normForRedList for both lists: strips noise words, brackets, date suffixes.
    // Sheet names are HubSpot deal names ("Elevva - New Deal") while Jira uses compact
    // identifiers ("Elevva") — normForRedList bridges that gap for both lists.
    const sensitiveNorms = sensitiveClients
      .map((c) => ({ name: c.name, normName: normForRedList(c.name) }))
      .filter((c) => c.normName.length > 1); // skip header rows / empty
    const redListNorms = redListClients
      .map((c) => ({ name: c.name, normName: normForRedList(c.name) }))
      .filter((c) => c.normName.length > 1);

    // DEBUG
    const debug = {
      sensitiveCount: sensitiveClients.length,
      redListCount: redListClients.length,
      sampleSensitiveNames: sensitiveClients.slice(0, 10).map((c) => ({ raw: c.name, norm: norm(c.name) })),
      staleBugsWithClients: staleBugs.filter((b) => b.affectedClients?.length).length,
      sampleBugClients: staleBugs.filter((b) => b.affectedClients?.length).slice(0, 3).map((b) => ({
        id: b.id,
        affectedClients: b.affectedClients.map((c) => ({ raw: c, norm: norm(c) })),
      })),
    };

    let reminded = 0;
    const results = [];

    for (const bug of staleBugs) {
      if (!bug.affectedClients?.length) continue;

      // Collect all sensitive/redlist clients on this bug
      const matchedClients = [];
      for (const jiraClient of bug.affectedClients) {
        const jiraNorm = normForRedList(jiraClient);
        const sens = sensitiveNorms.find((s) => s.normName === jiraNorm);
        if (sens) {
          matchedClients.push(jiraClient);
        } else {
          const rl = redListNorms.find((r) => r.normName === jiraNorm);
          if (rl) matchedClients.push(rl.name);
        }
      }
      if (!matchedClients.length) continue;

      // Stagnation start = MAX(last status change, first sensitive client added)
      const sensitiveClientsLower = matchedClients.map((c) => c.toLowerCase().trim());
      const stagnationStart = await getStagnationStart(bug.id, bug.created, sensitiveClientsLower);
      const daysSinceChange = Math.floor((Date.now() - stagnationStart.getTime()) / (1000 * 60 * 60 * 24));

      // Must be at least STAGNANT_DAYS from stagnation start
      if (daysSinceChange < STAGNANT_DAYS) continue;

      if (await isAlreadyReminded(bug.id, stagnationStart)) {
        console.log(`[stale-reminder] ${bug.id}: already reminded for this period`);
        continue;
      }

      const text = buildReminderMessage(bug, matchedClients, daysSinceChange);
      const sent = await sendSlackMessage(text);
      if (sent) {
        await recordReminder(bug.id, stagnationStart, bug.status);
        reminded++;
        results.push({ bugId: bug.id, clients: matchedClients, days: daysSinceChange });
        console.log(`[stale-reminder] reminded: ${bug.id} (${daysSinceChange}d) clients=${matchedClients.join(', ')}`);
      }
    }

    console.log(`[stale-reminder] checked=${staleBugs.length} reminded=${reminded}`);
    return res.status(200).json({ ok: true, checked: staleBugs.length, reminded, results, debug });
  } catch (err) {
    console.error('[stale-reminder]', err);
    return res.status(500).json({ error: err.message });
  }
}
