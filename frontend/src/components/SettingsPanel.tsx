import React, { useEffect, useState } from 'react';

const API = '/api/v1/admin';

interface FieldDef {
 key: string;
 label: string;
 help: string;
 type?: string;
}

const GROUPS: { title: string; fields: FieldDef[] }[] = [
 {
 title: 'Reglas de Marcado',
 fields: [
 { key: 'dedup_minutos', label: 'Ventana anti doble-marcado (min)', help: 'Marcas dentro de este rango se toman como la misma (la más temprana).', type: 'number' },
 { key: 'break_umbral_minutos', label: 'Umbral para activar refrigerio (min)', help: 'Tras este tiempo trabajando, una nueva marca abre el refrigerio.', type: 'number' },
 { key: 'umbral_nueva_jornada_horas', label: 'Hueco para nueva jornada (horas)', help: 'Separación que distingue una jornada de la siguiente. Debe superar el mayor hueco entre marcas de un mismo turno.', type: 'number' },
 ],
 },
 {
 title: 'Horas Nocturnas y Extra',
 fields: [
 { key: 'nocturno_inicio', label: 'Inicio horario nocturno', help: 'Formato 24h (ej. 22:00).', type: 'time' },
 { key: 'nocturno_fin', label: 'Fin horario nocturno', help: 'Formato 24h (ej. 06:00).', type: 'time' },
 { key: 'mult_nocturno', label: 'Multiplicador nocturno', help: 'Factor sobre la tarifa base en horas nocturnas (ej. 1.35).', type: 'number' },
 { key: 'horas_jornada_normal', label: 'Horas normales por jornada', help: 'A partir de aquí las horas se pagan como extra.', type: 'number' },
 { key: 'mult_extra', label: 'Multiplicador horas extra', help: 'Factor sobre la tarifa base en horas extra (ej. 1.25).', type: 'number' },
 { key: 'moneda', label: 'Símbolo de moneda', help: 'Ej. S/, $, €.' },
 ],
 },
 {
 title: 'Dispositivo Hikvision',
 fields: [
 { key: 'device_ip', label: 'IP del dispositivo', help: 'Dirección del terminal en la red local.' },
 { key: 'device_user', label: 'Usuario', help: 'Usuario admin del terminal.' },
 { key: 'device_pass', label: 'Contraseña', help: 'Dejar en blanco para no cambiarla.', type: 'password' },
 ],
 },
];

export default function SettingsPanel() {
 const [values, setValues] = useState<Record<string, string>>({});
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [msg, setMsg] = useState('');
 const [error, setError] = useState('');

 const load = async () => {
 try {
 const res = await fetch(`${API}/config`);
 const data = await res.json();
 const cfg = { ...data.config };
 if (cfg.device_pass === '********') cfg.device_pass = '';
 setValues(cfg);
 } catch {
 setError('No se pudo conectar al servidor local en el puerto 5000.');
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => { load(); }, []);

 const handleSave = async (e: React.FormEvent) => {
 e.preventDefault();
 setSaving(true); setMsg(''); setError('');
 try {
 const payload = { ...values };
 if (!payload.device_pass) delete payload.device_pass; // no sobreescribir si está vacío
 const res = await fetch(`${API}/config`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 });
 const data = await res.json();
 if (data.success) { setMsg('Configuración guardada correctamente.'); setTimeout(() => setMsg(''), 3000); }
 else setError(data.message || 'Error al guardar.');
 } catch {
 setError('Error de conexión al guardar.');
 } finally {
 setSaving(false);
 }
 };

 const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

 if (loading) return <div style={{ color: 'var(--text-secondary)' }}>Cargando configuración…</div>;

 return (
 <form onSubmit={handleSave} className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '25px', maxWidth: '900px' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <div>
 <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '6px' }}>Configuración del Sistema</h1>
 <p style={{ color: 'var(--text-secondary)' }}>Parámetros globales de marcado, horas y conexión al dispositivo.</p>
 </div>
 <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
 </div>

 {error && <div className="glass-panel" style={{ padding: '14px', color: 'var(--accent-error)', border: '1px solid var(--accent-error)' }}>{error}</div>}
 {msg && <div className="glass-panel" style={{ padding: '14px', color: 'var(--accent-success)', border: '1px solid var(--accent-success)' }}>{msg}</div>}

 {GROUPS.map((g) => (
 <div key={g.title} className="glass-panel" style={{ padding: '24px' }}>
 <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '18px', color: 'var(--text-primary)' }}>{g.title}</h3>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
 {g.fields.map((f) => (
 <div key={f.key}>
 <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '6px', fontWeight: 600 }}>{f.label}</label>
 <input
 className="form-input"
 type={f.type || 'text'}
 step={f.type === 'number' ? 'any' : undefined}
 value={values[f.key] ?? ''}
 placeholder={f.key === 'device_pass' ? '•••••• (sin cambios)' : ''}
 onChange={(e) => set(f.key, e.target.value)}
 />
 <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px', lineHeight: 1.4 }}>{f.help}</span>
 </div>
 ))}
 </div>
 </div>
 ))}
 </form>
 );
}
