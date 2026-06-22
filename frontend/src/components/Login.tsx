import { useState } from 'react';
import { setToken } from '../auth';

interface LoginProps {
  onSuccess: () => void;
}

export default function Login({ onSuccess }: LoginProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/v1/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        setToken(data.token);
        onSuccess();
      } else {
        setError(data.message || 'Contraseña incorrecta');
      }
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--bg-primary)', padding: '20px',
    }}>
      <form onSubmit={submit} className="glass-panel" style={{
        width: '100%', maxWidth: '380px', padding: '40px 32px',
        display: 'flex', flexDirection: 'column', gap: '22px', borderRadius: 'var(--border-radius-lg)',
      }}>
        {/* Identidad */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px', background: 'var(--accent-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#fff' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--text-primary)' }}>MASERVIT</h2>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>ASISTENCIA</span>
          </div>
        </div>

        <div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-primary)' }}>Acceso al panel</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Ingresá la contraseña para continuar.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Contraseña</label>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{
              padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(15,23,42,0.15)',
              fontSize: '0.95rem', background: 'var(--bg-secondary, #fff)', color: 'var(--text-primary)',
            }}
          />
        </div>

        {error && (
          <div style={{
            fontSize: '0.85rem', color: 'var(--accent-error, #dc2626)',
            background: 'rgba(220,38,38,0.08)', padding: '10px 12px', borderRadius: '8px',
          }}>{error}</div>
        )}

        <button type="submit" className="btn btn-primary" disabled={busy} style={{ padding: '12px', fontSize: '0.95rem' }}>
          {busy ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
