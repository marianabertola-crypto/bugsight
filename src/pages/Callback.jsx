import { useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PKCE_CODE_VERIFIER } from '../utils/pkce';
import './Login.css';

const CLIENT_ID = 'hu_staff_3EL7DWGB9VsTIGkcarkYfhrXUwXiemjShyNjAKwKnoM';

export default function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setToken } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = searchParams.get('code');
    const verifier = sessionStorage.getItem(PKCE_CODE_VERIFIER);

    if (!code || !verifier) {
      navigate('/login', { replace: true });
      return;
    }

    const redirectUri = `${window.location.origin}/callback`;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    });

    fetch('/api/janus-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
      .then(async (res) => {
        const text = await res.text();
        if (!res.ok) throw new Error(`Token exchange failed: ${res.status} - ${text}`);
        const data = JSON.parse(text);
        sessionStorage.removeItem(PKCE_CODE_VERIFIER);
        setToken(data.access_token);
        navigate('/', { replace: true });
      })
      .catch(() => navigate('/login', { replace: true }));
  }, [searchParams, navigate, setToken]);

  return (
    <div className="callback-page">
      <div className="callback-spinner" />
      <p>Iniciando sesión…</p>
    </div>
  );
}
