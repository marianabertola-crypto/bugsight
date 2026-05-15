// Vercel serverless function — exchanges OAuth2 code for Janus token
const JANUS_URL = 'https://api-prod.humand.co/api/v1/janus';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Vercel auto-parses urlencoded bodies into objects — convert back to string
    const bodyStr = typeof req.body === 'string'
      ? req.body
      : new URLSearchParams(req.body).toString();

    const janusRes = await fetch(`${JANUS_URL}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyStr,
    });

    const text = await janusRes.text();
    if (!janusRes.ok) {
      return res.status(janusRes.status).send(text);
    }

    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
