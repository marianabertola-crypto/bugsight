// Vercel serverless function — proxies Jira search API
// Required env vars: JIRA_EMAIL, JIRA_TOKEN
const JIRA_BASE_URL = 'https://humand.atlassian.net';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { JIRA_EMAIL, JIRA_TOKEN } = process.env;
  if (!JIRA_EMAIL || !JIRA_TOKEN) {
    return res.status(500).json({ error: 'Jira credentials not configured' });
  }

  const params = new URLSearchParams(req.query);
  const jiraUrl = `${JIRA_BASE_URL}/rest/api/3/search/jql?${params}`;

  try {
    const credentials = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');
    const jiraRes = await fetch(jiraUrl, {
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
      },
    });

    const text = await jiraRes.text();
    if (!jiraRes.ok) {
      return res.status(jiraRes.status).send(text);
    }

    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
