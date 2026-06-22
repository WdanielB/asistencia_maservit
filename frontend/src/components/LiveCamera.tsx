import { useState, useRef } from 'react';

const API = '/api/v1/admin';

export default function LiveCamera() {
 const [streaming, setStreaming] = useState(true);
 const [bust, setBust] = useState(Date.now());
 const [error, setError] = useState('');
 const imgRef = useRef<HTMLImageElement>(null);

 const reload = () => {
 setError('');
 setBust(Date.now());
 setStreaming(true);
 };

 const downloadSnapshot = () => {
 const a = document.createElement('a');
 a.href = `${API}/camara/snapshot?t=${Date.now()}`;
 a.download = `captura_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
 a.click();
 };

 return (
 <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <div>
 <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '6px' }}>Cámara en Vivo</h1>
 <p style={{ color: 'var(--text-secondary)' }}>Transmisión directa del terminal Hikvision DS-K1T320EFX.</p>
 </div>
 <div style={{ display: 'flex', gap: '10px' }}>
 <button className="btn btn-secondary" onClick={reload}>Reconectar</button>
 <button className="btn btn-primary" onClick={downloadSnapshot}>Capturar foto</button>
 </div>
 </div>

 <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
 <div style={{ position: 'relative', width: '100%', maxWidth: '900px', aspectRatio: '16 / 9', background: '#000', borderRadius: 'var(--border-radius-md)', overflow: 'hidden', border: '1px solid rgba(15,23,42,0.08)' }}>
 {streaming && !error && (
 <img
 ref={imgRef}
 src={`${API}/camara/stream?t=${bust}`}
 alt="Cámara en vivo"
 style={{ width: '100%', height: '100%', objectFit: 'contain' }}
 onError={() => { setStreaming(false); setError('No se pudo conectar con la cámara. Verificá que el dispositivo esté en línea.'); }}
 />
 )}
 {error && (
 <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
 <span style={{ fontSize: '2.5rem' }}></span>
 <span>{error}</span>
 <button className="btn btn-primary" onClick={reload}>Reintentar</button>
 </div>
 )}
 {streaming && !error && (
 <div className="live-indicator" style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.55)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>
 <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-error)', display: 'inline-block' }}></span>
 EN VIVO
 </div>
 )}
 </div>
 <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
 Transmisión por snapshots (~3 fps) vía proxy ISAPI. Para alta tasa de cuadros usá RTSP: <code style={{ color: 'var(--text-secondary)' }}>rtsp://&lt;usuario&gt;:&lt;clave&gt;@192.168.0.16:554/Streaming/Channels/101</code>
 </p>
 </div>
 </div>
 );
}
