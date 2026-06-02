// Vercel serverless function — fetches sensitive clients from Google Apps Script
// Required env var: SENSITIVE_CLIENTS_URL
// Cache: 1 hour via Cache-Control header

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { SENSITIVE_CLIENTS_URL } = process.env;
  if (!SENSITIVE_CLIENTS_URL) {
    return res.status(500).json({ error: 'SENSITIVE_CLIENTS_URL not configured' });
  }

  try {
    const response = await fetch(SENSITIVE_CLIENTS_URL);
    if (!response.ok) {
      throw new Error(`Apps Script error: ${response.status}`);
    }
    const data = await response.json();

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
