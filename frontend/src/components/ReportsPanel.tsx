import React, { useEffect, useState } from 'react';
import { withToken } from '../auth';

interface Worker {
 id: number;
 nombre: string;
 employee_no: string;
}

interface LogRecord {
 id: number;
 fecha: string;
 hora: string;
 tipo: 'ENTRADA' | 'BREAK_IN' | 'BREAK_OUT' | 'SALIDA';
 estado: 'PUNTUAL' | 'TARDANZA' | 'CORRECTO';
 foto_scan_url?: string;
 nombre_trabajador: string;
 employee_no: string;
}

export default function ReportsPanel() {
 const [logs, setLogs] = useState<LogRecord[]>([]);
 const [workers, setWorkers] = useState<Worker[]>([]);
 const [loading, setLoading] = useState(true);
 
 // Filter states
 const [startDate, setStartDate] = useState('');
 const [endDate, setEndDate] = useState('');
 const [workerId, setWorkerId] = useState('');
 const [type, setType] = useState('');
 const [status, setStatus] = useState('');

 // Manual Adjustment Modal state
 const [isModalOpen, setIsModalOpen] = useState(false);
 const [adjWorkerId, setAdjWorkerId] = useState('');
 const [adjDate, setAdjDate] = useState(new Date().toISOString().substring(0, 10));
 const [adjTime, setAdjTime] = useState('08:00:00');
 const [adjType, setAdjType] = useState('ENTRADA');
 const [adjStatus, setAdjStatus] = useState('PUNTUAL');

 const fetchLogs = async () => {
 setLoading(true);
 try {
 const params = new URLSearchParams();
 if (startDate) params.append('startDate', startDate);
 if (endDate) params.append('endDate', endDate);
 if (workerId) params.append('trabajadorId', workerId);
 if (type) params.append('tipo', type);
 if (status) params.append('estado', status);

 const resLogs = await fetch(`/api/v1/admin/marcaciones?${params.toString()}`);
 const dataLogs = await resLogs.json();
 if (dataLogs.success) {
 setLogs(dataLogs.marcaciones);
 }
 } catch (err) {
 console.error('Error cargando historial de marcaciones:', err);
 } finally {
 setLoading(false);
 }
 };

 const fetchWorkers = async () => {
 try {
 const res = await fetch('/api/v1/admin/trabajadores');
 const data = await res.json();
 if (data.success) {
 setWorkers(data.trabajadores);
 }
 } catch (err) {
 console.error('Error cargando trabajadores:', err);
 }
 };

 useEffect(() => {
 fetchLogs();
 fetchWorkers();
 }, []);

 const handleApplyFilters = (e: React.FormEvent) => {
 e.preventDefault();
 fetchLogs();
 };

 const handleClearFilters = () => {
 setStartDate('');
 setEndDate('');
 setWorkerId('');
 setType('');
 setStatus('');
 // Forzar recarga inmediata de todos los logs
 setTimeout(() => {
 fetchLogs();
 }, 50);
 };

 const handleSaveAdjustment = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!adjWorkerId || !adjDate || !adjTime) {
 alert('Por favor completa todos los campos.');
 return;
 }

 const payload = {
 trabajador_id: Number(adjWorkerId),
 fecha: adjDate,
 hora: adjTime,
 tipo: adjType,
 estado: adjStatus
 };

 try {
 const response = await fetch('/api/v1/admin/marcaciones/manual', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload)
 });

 const result = await response.json();
 if (result.success) {
 setIsModalOpen(false);
 fetchLogs();
 } else {
 alert(result.message);
 }
 } catch (err) {
 alert('Error guardando ajuste manual.');
 }
 };

 const getTipoBadge = (tipo: string) => {
 switch (tipo) {
 case 'ENTRADA': return <span className="badge badge-success">Entrada</span>;
 case 'BREAK_IN': return <span className="badge badge-warning">Inicio Break</span>;
 case 'BREAK_OUT': return <span className="badge badge-info">Fin Break</span>;
 case 'SALIDA': return <span className="badge badge-success" style={{ filter: 'hue-rotate(90deg)' }}>Salida</span>;
 default: return <span className="badge">{tipo}</span>;
 }
 };

 const getEstadoBadge = (estado: string) => {
 switch (estado) {
 case 'PUNTUAL': return <span className="badge badge-success">Puntual</span>;
 case 'TARDANZA': return <span className="badge badge-error">Tardanza</span>;
 case 'CORRECTO': return <span className="badge badge-info">Correcto</span>;
 default: return <span className="badge">{estado}</span>;
 }
 };

 return (
 <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
 
 {/* Encabezado */}
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <div>
 <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '6px' }}>Historial y Reportes</h1>
 <p style={{ color: 'var(--text-secondary)' }}>Filtra y analiza los logs de acceso o realiza ajustes manuales.</p>
 </div>
 <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
 Registrar Ajuste Manual
 </button>
 </div>

 {/* Formulario de Filtros */}
 <form onSubmit={handleApplyFilters} className="glass-panel" style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'end' }}>
 <div>
 <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Fecha Inicio</label>
 <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
 </div>
 <div>
 <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Fecha Fin</label>
 <input type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
 </div>
 <div>
 <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Trabajador</label>
 <select className="form-input" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
 <option value="">Todos</option>
 {workers.map(w => (
 <option key={w.id} value={w.id}>{w.nombre}</option>
 ))}
 </select>
 </div>
 <div>
 <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Tipo</label>
 <select className="form-input" value={type} onChange={(e) => setType(e.target.value)}>
 <option value="">Todos</option>
 <option value="ENTRADA">Entrada</option>
 <option value="BREAK_IN">Inicio Break</option>
 <option value="BREAK_OUT">Fin Break</option>
 <option value="SALIDA">Salida</option>
 </select>
 </div>
 <div>
 <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Estado</label>
 <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
 <option value="">Todos</option>
 <option value="PUNTUAL">Puntual</option>
 <option value="TARDANZA">Tardanza</option>
 <option value="CORRECTO">Correcto</option>
 </select>
 </div>
 <div style={{ display: 'flex', gap: '8px' }}>
 <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '10px' }}>Filtrar</button>
 <button type="button" className="btn btn-secondary" onClick={handleClearFilters} style={{ padding: '10px' }}>Limpiar</button>
 <a
 className="btn btn-secondary"
 style={{ padding: '10px', textDecoration: 'none' }}
 href={withToken(`/api/v1/admin/marcaciones.csv?${new URLSearchParams({ ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}), ...(workerId ? { trabajadorId: workerId } : {}) }).toString()}`)}
 >Exportar CSV</a>
 </div>
 </form>

 {/* Tabla de Logs */}
 <div className="glass-panel" style={{ padding: '24px', overflowX: 'auto' }}>
 {loading ? (
 <div style={{ padding: '40px 0', textTransform: 'uppercase', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600, letterSpacing: '0.1em' }}>
 Consultando registros...
 </div>
 ) : logs.length === 0 ? (
 <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
 <p style={{ fontSize: '2.5rem', marginBottom: '10px' }}></p>
 <p>No se encontraron marcaciones para los filtros seleccionados.</p>
 </div>
 ) : (
 <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
 <thead>
 <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
 <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Foto Scan</th>
 <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Trabajador</th>
 <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>ID Hikvision</th>
 <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Fecha</th>
 <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Hora</th>
 <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Tipo</th>
 <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Estado</th>
 </tr>
 </thead>
 <tbody>
 {logs.map((log) => (
 <tr key={log.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.04)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(15,23,42,0.02)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
 <td style={{ padding: '12px 16px' }}>
 <div style={{ 
 width: '40px', 
 height: '40px', 
 borderRadius: '8px', 
 overflow: 'hidden', 
 border: '1px solid rgba(15,23,42,0.08)',
 backgroundColor: 'rgba(15,23,42,0.01)',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center'
 }}>
 {log.foto_scan_url === 'manual' ? (
 <span style={{ fontSize: '1.1rem' }}></span>
 ) : log.foto_scan_url ? (
 <img
 src={`${log.foto_scan_url}`}
 alt="Captura"
 title="Ver captura completa"
 style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
 onClick={() => window.open(log.foto_scan_url, '_blank')}
 onError={(e) => {
 (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(log.nombre_trabajador)}`;
 }}
 />
 ) : (
 <img 
 src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(log.nombre_trabajador)}`} 
 alt="Initials" 
 style={{ width: '100%', height: '100%' }}
 />
 )}
 </div>
 </td>
 <td style={{ padding: '12px 16px', fontWeight: 600 }}>{log.nombre_trabajador}</td>
 <td style={{ padding: '12px 16px', color: 'var(--accent-info)', fontWeight: 'bold' }}>{log.employee_no}</td>
 <td style={{ padding: '12px 16px' }}>{log.fecha}</td>
 <td style={{ padding: '12px 16px', fontWeight: 500 }}>{log.hora}</td>
 <td style={{ padding: '12px 16px' }}>{getTipoBadge(log.tipo)}</td>
 <td style={{ padding: '12px 16px' }}>{getEstadoBadge(log.estado)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </div>

 {/* Modal - Ajuste Manual */}
 {isModalOpen && (
 <div style={{
 position: 'fixed',
 top: 0,
 left: 0,
 right: 0,
 bottom: 0,
 backgroundColor: 'rgba(0,0,0,0.6)',
 backdropFilter: 'blur(8px)',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 zIndex: 1000
 }}>
 <div className="glass-panel" style={{
 padding: '30px',
 width: '100%',
 maxWidth: '500px',
 boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
 }}>
 <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '20px' }}>
 Registrar Ajuste Manual
 </h3>

 <form onSubmit={handleSaveAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
 <div>
 <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Trabajador</label>
 <select className="form-input" value={adjWorkerId} onChange={(e) => setAdjWorkerId(e.target.value)} required>
 <option value="">Selecciona un trabajador...</option>
 {workers.map(w => (
 <option key={w.id} value={w.id}>{w.nombre} (ID: {w.employee_no})</option>
 ))}
 </select>
 </div>

 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
 <div>
 <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Fecha</label>
 <input type="date" className="form-input" value={adjDate} onChange={(e) => setAdjDate(e.target.value)} required />
 </div>
 <div>
 <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Hora</label>
 <input type="text" className="form-input" placeholder="HH:MM:SS" value={adjTime} onChange={(e) => setAdjTime(e.target.value)} required />
 </div>
 </div>

 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
 <div>
 <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Tipo de Marcación</label>
 <select className="form-input" value={adjType} onChange={(e) => setAdjType(e.target.value)}>
 <option value="ENTRADA">Entrada</option>
 <option value="BREAK_IN">Inicio Break</option>
 <option value="BREAK_OUT">Fin Break</option>
 <option value="SALIDA">Salida</option>
 </select>
 </div>
 <div>
 <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Estado de Marcación</label>
 <select className="form-input" value={adjStatus} onChange={(e) => setAdjStatus(e.target.value)}>
 <option value="PUNTUAL">Puntual</option>
 <option value="TARDANZA">Tardanza</option>
 <option value="CORRECTO">Correcto</option>
 </select>
 </div>
 </div>

 <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
 <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
 Cancelar
 </button>
 <button type="submit" className="btn btn-primary">
 Registrar Marcación
 </button>
 </div>
 </form>
 </div>
 </div>
 )}

 </div>
 );
}
