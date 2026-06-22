import React, { useEffect, useState } from 'react';
import { withToken } from '../auth';

const API = '/api/v1/admin';

interface SessionResult {
 fecha: string;
 entrada: number;
 salida: number;
 trabajadoMin: number;
 refrigerioMin: number;
 diaNormalMin: number;
 nocheNormalMin: number;
 diaExtraMin: number;
 nocheExtraMin: number;
 monto: number;
 cruzaMedianoche: boolean;
}

interface WorkerRow {
 trabajador_id: number;
 nombre: string;
 employee_no: string;
 foto_url?: string;
 tarifa_hora: number;
 totalTrabajadoH: number;
 totalRefrigerioH: number;
 nocturnasH: number;
 extraH: number;
 montoTotal: number;
 sesionesCount: number;
 sessions: SessionResult[];
}

const fmtH = (h: number) => `${h.toFixed(2)} h`;
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' });

// Lunes de la semana ISO de una fecha
function weekKey(ts: number): string {
 const d = new Date(ts);
 const day = (d.getDay() + 6) % 7; // lunes=0
 const monday = new Date(d);
 monday.setDate(d.getDate() - day);
 monday.setHours(0, 0, 0, 0);
 return monday.toISOString().substring(0, 10);
}

export default function PersonalDashboard() {
 const today = new Date();
 const monday = new Date(today);
 monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

 const iso = (d: Date) => d.toISOString().substring(0, 10);

 const [startDate, setStartDate] = useState(iso(monday));
 const [endDate, setEndDate] = useState(iso(today));
 const [rows, setRows] = useState<WorkerRow[]>([]);
 const [totales, setTotales] = useState<any>({});
 const [moneda, setMoneda] = useState('S/');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [detail, setDetail] = useState<WorkerRow | null>(null);

 const load = async (s = startDate, e = endDate) => {
 setLoading(true); setError('');
 try {
 const res = await fetch(`${API}/reportes/horas?startDate=${s}&endDate=${e}`);
 const data = await res.json();
 if (data.success) {
 setRows(data.trabajadores);
 setTotales(data.totales);
 setMoneda(data.moneda);
 } else setError(data.message || 'Error al cargar el reporte.');
 } catch {
 setError('No se pudo conectar al servidor local en el puerto 5000.');
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => { load(); }, []);

 // Presets de rango: día, semana (lunes-hoy), mes (1ro-hoy)
 const applyPreset = (kind: 'dia' | 'semana' | 'mes') => {
 const now = new Date();
 let s = new Date(now);
 if (kind === 'semana') s.setDate(now.getDate() - ((now.getDay() + 6) % 7));
 else if (kind === 'mes') s = new Date(now.getFullYear(), now.getMonth(), 1);
 const si = iso(s), ei = iso(now);
 setStartDate(si); setEndDate(ei); load(si, ei);
 };

 const exportUrl = withToken(`${API}/reportes/horas.csv?startDate=${startDate}&endDate=${endDate}`);

 const conMovimiento = rows.filter((r) => r.sesionesCount > 0).sort((a, b) => b.montoTotal - a.montoTotal);
 const sinMovimiento = rows.filter((r) => r.sesionesCount === 0);

 const stat = (label: string, value: string, color: string) => (
 <div className="glass-panel" style={{ padding: '20px', flex: 1, minWidth: '160px' }}>
 <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
 <div style={{ fontSize: '1.7rem', fontWeight: 800, color, marginTop: '6px' }}>{value}</div>
 </div>
 );

 const avatar = (w: { foto_url?: string; nombre: string }, size = 34) => (
 <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(15,23,42,0.1)', flexShrink: 0 }}>
 <img
 src={w.foto_url ? `${w.foto_url}` : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(w.nombre)}`}
 alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
 onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(w.nombre)}`; }}
 />
 </div>
 );

 return (
 <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
 <div>
 <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '6px' }}>Control de Personal</h1>
 <p style={{ color: 'var(--text-secondary)' }}>Horas trabajadas, nocturnas, extra y monto a pagar por trabajador.</p>
 </div>

 {/* Filtros de rango */}
 <div className="glass-panel" style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'end', flexWrap: 'wrap' }}>
 <div>
 <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Desde</label>
 <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
 </div>
 <div>
 <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Hasta</label>
 <input type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
 </div>
 <button className="btn btn-primary" onClick={() => load()} disabled={loading}>{loading ? 'Calculando…' : 'Aplicar'}</button>
 <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
 <button className="btn btn-secondary" onClick={() => applyPreset('dia')}>Hoy</button>
 <button className="btn btn-secondary" onClick={() => applyPreset('semana')}>Semana</button>
 <button className="btn btn-secondary" onClick={() => applyPreset('mes')}>Mes</button>
 <a className="btn btn-secondary" href={exportUrl} style={{ textDecoration: 'none' }}>Exportar CSV</a>
 </div>
 </div>

 {error && <div className="glass-panel" style={{ padding: '14px', color: 'var(--accent-error)' }}>{error}</div>}

 {/* Totales */}
 <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
 {stat('Horas trabajadas', fmtH(totales.totalTrabajadoH || 0), 'var(--accent-info)')}
 {stat('Horas nocturnas', fmtH(totales.nocturnasH || 0), 'var(--accent-primary)')}
 {stat('Horas extra', fmtH(totales.extraH || 0), 'var(--accent-warning)')}
 {stat('Monto total a pagar', `${moneda} ${(totales.montoTotal || 0).toFixed(2)}`, 'var(--accent-success)')}
 </div>

 {/* Tabla por trabajador */}
 <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
 <div style={{ overflowX: 'auto' }}>
 <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
 <thead>
 <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
 <th style={{ padding: '14px 16px' }}>Trabajador</th>
 <th style={{ padding: '14px 16px' }}>Jornadas</th>
 <th style={{ padding: '14px 16px' }}>Trabajadas</th>
 <th style={{ padding: '14px 16px' }}>Nocturnas</th>
 <th style={{ padding: '14px 16px' }}>Extra</th>
 <th style={{ padding: '14px 16px' }}>Tarifa/h</th>
 <th style={{ padding: '14px 16px', textAlign: 'right' }}>Monto</th>
 </tr>
 </thead>
 <tbody>
 {conMovimiento.map((w) => (
 <tr key={w.trabajador_id}
 onClick={() => setDetail(w)}
 style={{ borderBottom: '1px solid rgba(15,23,42,0.04)', cursor: 'pointer' }}
 onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(15,23,42,0.03)')}
 onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
 <td style={{ padding: '12px 16px' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
 {avatar(w)}
 <div>
 <div style={{ fontWeight: 600 }}>{w.nombre}</div>
 <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>#{w.employee_no}</div>
 </div>
 </div>
 </td>
 <td style={{ padding: '12px 16px' }}>{w.sesionesCount}</td>
 <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--accent-info)' }}>{fmtH(w.totalTrabajadoH)}</td>
 <td style={{ padding: '12px 16px', color: 'var(--accent-primary)' }}>{fmtH(w.nocturnasH)}</td>
 <td style={{ padding: '12px 16px', color: 'var(--accent-warning)' }}>{fmtH(w.extraH)}</td>
 <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{moneda} {w.tarifa_hora.toFixed(2)}</td>
 <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--accent-success)' }}>{moneda} {w.montoTotal.toFixed(2)}</td>
 </tr>
 ))}
 {conMovimiento.length === 0 && !loading && (
 <tr><td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Sin marcaciones en el rango seleccionado.</td></tr>
 )}
 </tbody>
 </table>
 </div>
 </div>

 {sinMovimiento.length > 0 && (
 <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
 Sin actividad en el rango ({sinMovimiento.length}): {sinMovimiento.map((w) => w.nombre).join(', ')}
 </div>
 )}

 {detail && (
 <WorkerDetail worker={detail} moneda={moneda} onClose={() => setDetail(null)} avatar={avatar} />
 )}
 </div>
 );
}

function WorkerDetail({ worker, moneda, onClose, avatar }: { worker: WorkerRow; moneda: string; onClose: () => void; avatar: (w: any, s?: number) => React.ReactNode }) {
 // Agrupar sesiones por semana
 const byWeek = new Map<string, SessionResult[]>();
 for (const s of worker.sessions) {
 const k = weekKey(s.entrada);
 if (!byWeek.has(k)) byWeek.set(k, []);
 byWeek.get(k)!.push(s);
 }
 const weeks = [...byWeek.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

 return (
 <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}>
 <div onClick={(e) => e.stopPropagation()} className="glass-panel" style={{ width: '100%', maxWidth: '820px', maxHeight: '88vh', overflowY: 'auto', padding: '28px' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
 {avatar(worker, 52)}
 <div>
 <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{worker.nombre}</h2>
 <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>#{worker.employee_no} · Tarifa {moneda} {worker.tarifa_hora.toFixed(2)}/h</div>
 </div>
 </div>
 <button className="btn btn-secondary" onClick={onClose}>✕ Cerrar</button>
 </div>

 {/* Totales del trabajador */}
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: '12px', marginBottom: '24px' }}>
 {[
 ['Trabajadas', fmtH(worker.totalTrabajadoH), 'var(--accent-info)'],
 ['Refrigerio', fmtH(worker.totalRefrigerioH), 'var(--text-secondary)'],
 ['Nocturnas', fmtH(worker.nocturnasH), 'var(--accent-primary)'],
 ['Extra', fmtH(worker.extraH), 'var(--accent-warning)'],
 ['A pagar', `${moneda} ${worker.montoTotal.toFixed(2)}`, 'var(--accent-success)'],
 ].map(([l, v, c]) => (
 <div key={l} style={{ background: 'rgba(15,23,42,0.03)', borderRadius: 'var(--border-radius-sm)', padding: '12px' }}>
 <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{l}</div>
 <div style={{ fontSize: '1.1rem', fontWeight: 800, color: c as string }}>{v}</div>
 </div>
 ))}
 </div>

 {/* Detalle por semana */}
 {weeks.map(([wk, sessions]) => {
 const totW = sessions.reduce((a, s) => a + s.trabajadoMin, 0) / 60;
 const totPay = sessions.reduce((a, s) => a + s.monto, 0);
 return (
 <div key={wk} style={{ marginBottom: '20px' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
 <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Semana del {new Date(wk).toLocaleDateString('es-PE', { day: '2-digit', month: 'long' })}</h4>
 <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{totW.toFixed(2)} h · {moneda} {totPay.toFixed(2)}</span>
 </div>
 <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
 <thead>
 <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
 <th style={{ padding: '6px 8px' }}>Día</th>
 <th style={{ padding: '6px 8px' }}>Entrada</th>
 <th style={{ padding: '6px 8px' }}>Salida</th>
 <th style={{ padding: '6px 8px' }}>Trab.</th>
 <th style={{ padding: '6px 8px' }}>Refrig.</th>
 <th style={{ padding: '6px 8px', textAlign: 'right' }}>Monto</th>
 </tr>
 </thead>
 <tbody>
 {sessions.sort((a, b) => a.entrada - b.entrada).map((s, i) => (
 <tr key={i} style={{ borderTop: '1px solid rgba(15,23,42,0.05)' }}>
 <td style={{ padding: '6px 8px' }}>{fmtDate(s.entrada)}</td>
 <td style={{ padding: '6px 8px' }}>{fmtTime(s.entrada)}</td>
 <td style={{ padding: '6px 8px' }}>
 {fmtTime(s.salida)}
 {s.cruzaMedianoche && <span title="Cruza la medianoche" style={{ marginLeft: '5px', fontSize: '0.7rem', color: 'var(--accent-primary)' }}>+1d </span>}
 </td>
 <td style={{ padding: '6px 8px', fontWeight: 600 }}>{(s.trabajadoMin / 60).toFixed(2)}h</td>
 <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{(s.refrigerioMin / 60).toFixed(2)}h</td>
 <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--accent-success)', fontWeight: 700 }}>{moneda} {s.monto.toFixed(2)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 );
 })}
 {worker.sessions.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Sin jornadas registradas en el rango.</p>}
 </div>
 </div>
 );
}
