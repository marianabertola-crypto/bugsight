// Vercel serverless function — posts a message to Slack
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { SLACK_BOT_TOKEN } = process.env;
  if (!SLACK_BOT_TOKEN) return res.status(500).json({ error: 'Slack token not configured' });

  const { channel, text } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  try {
    const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({ channel, text }),
    });
    const data = await slackRes.json();
    if (!data.ok) return res.status(400).json({ error: data.error });
    res.status(200).json({ ok: true, ts: data.ts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
