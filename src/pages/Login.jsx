import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { generateVerifier, createChallenge, PKCE_CODE_VERIFIER } from '../utils/pkce';
import './Login.css';

const JANUS_URL = 'https://api-prod.humand.co/api/v1/janus';
const CLIENT_ID = 'hu_staff_3EL7DWGB9VsTIGkcarkYfhrXUwXiemjShyNjAKwKnoM';

function makeDevToken() {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ name: 'Dev User', email: 'dev@humand.co', sub: 'dev' }));
  return `${header}.${payload}.dev`;
}

export default function Login() {
  const { setToken } = useAuth();
  const navigate = useNavigate();

  function handleDevLogin() {
    setToken(makeDevToken());
    navigate('/', { replace: true });
  }

  async function handleLogin() {
    const verifier = generateVerifier();
    const challenge = await createChallenge(verifier);
    sessionStorage.setItem(PKCE_CODE_VERIFIER, verifier);

    const redirectUri = `${window.location.origin}/callback`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    window.location.href = `${JANUS_URL}/oauth2/authorize?${params.toString()}&continue`;
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">B</div>
          <span className="login-logo-name">BugSight</span>
        </div>
        <h1 className="login-title">Bienvenido</h1>
        <p className="login-subtitle">Ingresá con tu cuenta de Humand para continuar</p>
        <button className="login-google-btn" onClick={handleLogin}>
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
            <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05" />
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
          </svg>
          Continuar con Google
        </button>

        {import.meta.env.DEV && (
          <button className="login-dev-btn" onClick={handleDevLogin}>
            ⚡ Dev login (solo local)
          </button>
        )}
      </div>
    </div>
  );
}
