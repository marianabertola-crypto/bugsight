// Vercel Cron Job — runs every 10 minutes
// Detects new bugs for sensitive/red list clients and notifies Slack
// Required env vars: JIRA_EMAIL, JIRA_TOKEN, SENSITIVE_CLIENTS_URL,
//                    SLACK_BOT_TOKEN, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

const JIRA_BASE_URL = 'https://humand.atlassian.net';
const SLACK_CHANNEL = 'produc-etas-test';

// Module → PM Slack ID map
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

// ── Normalization ────────────────────────────────────────────────────────────

function norm(s) {
  return s?.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim() ?? '';
}

function normLoose(s) {
  return s?.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s\-_.,()[\]°'"]/g, '').toLowerCase() ?? '';
}

function matchesRedListName(jiraClient, redListNorm) {
  const nc = normLoose(jiraClient);
  if (!nc || !redListNorm || redListNorm.length < 3) return nc === redListNorm;
  return nc.includes(redListNorm) || redListNorm.includes(nc);
}

// ── Module extraction ────────────────────────────────────────────────────────

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

// ── Jira ─────────────────────────────────────────────────────────────────────

async function fetchRecentBugs() {
  const { JIRA_EMAIL, JIRA_TOKEN } = process.env;
  const credentials = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');
  const jql = 'issuetype = Bug AND project != HUREP AND created >= "-15m" ORDER BY created DESC';
  const fields = 'summary,status,created,customfield_10071,customfield_10046';
  const params = new URLSearchParams({ jql, fields, maxResults: 50 });

  const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/search/jql?${params}`, {
    headers: { Authorization: `Basic ${credentials}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Jira error: ${res.status}`);
  const data = await res.json();

  return (data.issues || []).map((issue) => {
    const f = issue.fields;
    const miniAppsField = f.customfield_10071;
    const affectedClients = Array.isArray(f.customfield_10046)
      ? f.customfield_10046.map((c) => (typeof c === 'string' ? c : c?.value)).filter(Boolean)
      : [];
    return {
      id: issue.key,
      title: f.summary,
      module: extractModule(miniAppsField, f.summary),
      affectedClients,
    };
  });
}

// ── Google Sheets (Apps Script) ──────────────────────────────────────────────

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

// ── Supabase ─────────────────────────────────────────────────────────────────

function supabaseHeaders() {
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function isAlreadyNotified(bugId) {
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/notified_bugs?bug_id=eq.${bugId}&select=bug_id`;
  const res = await fetch(url, { headers: supabaseHeaders() });
  const data = await res.json();
  return Array.isArray(data) && data.length > 0;
}

async function recordNotification(bugId, clientName, clientType) {
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/notified_bugs`;
  await fetch(url, {
    method: 'POST',
    headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ bug_id: bugId, client_name: clientName, client_type: clientType }),
  });
}

// ── Slack ────────────────────────────────────────────────────────────────────

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

function buildSlackMessage(bug, clientName) {
  const moduleInfo = MODULES[bug.module] || {};
  const pmMention = moduleInfo.slackId
    ? `<@${moduleInfo.slackId}>`
    : moduleInfo.pm || 'Sin PM asignado';
  const jiraUrl = `${JIRA_BASE_URL}/browse/${bug.id}`;

  return [
    '🚨 *Cliente en Red List*',
    `*Cliente:* ${clientName}`,
    `*Bug:* <${jiraUrl}|${bug.id} ${bug.title}>`,
    `*Módulo:* ${bug.module} — PM: ${pmMention}`,
    '',
    '¿Podríamos darle prioridad, por favor? Muchas gracias!',
  ].join('\n');
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const [recentBugs, sensitiveClients, redListClients] = await Promise.all([
      fetchRecentBugs(),
      fetchClients('sensitive'),
      fetchClients('redlist'),
    ]);

    const sensitiveSet = new Set(sensitiveClients.map((c) => norm(c.name)));
    const redListNorms = redListClients.map((c) => ({ name: c.name, normName: normLoose(c.name) }));

    let notified = 0;
    const results = [];

    for (const bug of recentBugs) {
      if (!bug.affectedClients?.length) continue;
      if (await isAlreadyNotified(bug.id)) continue;

      // Find first matching client (sensitive takes priority)
      let matchedClient = null;
      let clientType = null;

      for (const jiraClient of bug.affectedClients) {
        if (sensitiveSet.has(norm(jiraClient))) {
          matchedClient = jiraClient;
          clientType = 'sensitive';
          break;
        }
      }

      if (!matchedClient) {
        for (const jiraClient of bug.affectedClients) {
          const rl = redListNorms.find((r) => matchesRedListName(jiraClient, r.normName));
          if (rl) {
            matchedClient = rl.name;
            clientType = 'redlist';
            break;
          }
        }
      }

      if (!matchedClient) continue;

      const text = buildSlackMessage(bug, matchedClient);
      const sent = await sendSlackMessage(text);
      if (sent) {
        await recordNotification(bug.id, matchedClient, clientType);
        notified++;
        results.push({ bugId: bug.id, client: matchedClient, type: clientType });
      }
    }

    console.log(`[alert-redlist] checked=${recentBugs.length} notified=${notified}`);
    return res.status(200).json({ ok: true, checked: recentBugs.length, notified, results });
  } catch (err) {
    console.error('[alert-redlist]', err);
    return res.status(500).json({ error: err.message });
  }
}
