import { useEffect, useState } from 'react';

interface Stats {
 totalTrabajadores: number;
 totalHorarios: number;
 totalEntradasHoy: number;
 totalTardanzasHoy: number;
 totalBreaksActivos: number;
 ausentes: number;
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

export default function DashboardHome() {
 const [stats, setStats] = useState<Stats>({
 totalTrabajadores: 0,
 totalHorarios: 0,
 totalEntradasHoy: 0,
 totalTardanzasHoy: 0,
 totalBreaksActivos: 0,
 ausentes: 0
 });
 const [logs, setLogs] = useState<LogRecord[]>([]);
 const [connectionStatus, setConnectionStatus] = useState<'conectar' | 'conectado' | 'desconectado'>('desconectado');

 const fetchStats = async () => {
 try {
 const response = await fetch('/api/v1/admin/dashboard-stats');
 const data = await response.json();
 if (data.success) {
 setStats(data.stats);
 setLogs(data.logsRecientes);
 }
 } catch (err) {
 console.error('Error cargando estadísticas del dashboard:', err);
 }
 };

 useEffect(() => {
 fetchStats();
 
 // Iniciar conexión SSE para actualizaciones en tiempo real
 setConnectionStatus('conectar');
 const eventSource = new EventSource('/api/v1/admin/live-feed');

 eventSource.onopen = () => {
 setConnectionStatus('conectado');
 console.log('Conexión SSE establecida exitosamente.');
 };

 eventSource.onmessage = (event) => {
 try {
 const newLog = JSON.parse(event.data) as LogRecord;
 console.log('Nueva marcación recibida en tiempo real:', newLog);
 
 // Agregar al inicio de los logs y limitar a 15
 setLogs((prev) => [newLog, ...prev.slice(0, 14)]);
 
 // Actualizar estadísticas de forma inteligente en caliente
 setStats((prev) => {
 const isEntrada = newLog.tipo === 'ENTRADA';
 const isTardanza = isEntrada && newLog.estado === 'TARDANZA';
 const isBreakIn = newLog.tipo === 'BREAK_IN';
 const isBreakOut = newLog.tipo === 'BREAK_OUT';

 return {
 ...prev,
 totalEntradasHoy: isEntrada ? prev.totalEntradasHoy + 1 : prev.totalEntradasHoy,
 totalTardanzasHoy: isTardanza ? prev.totalTardanzasHoy + 1 : prev.totalTardanzasHoy,
 totalBreaksActivos: isBreakIn 
 ? prev.totalBreaksActivos + 1 
 : isBreakOut 
 ? Math.max(0, prev.totalBreaksActivos - 1) 
 : prev.totalBreaksActivos,
 ausentes: isEntrada ? Math.max(0, prev.ausentes - 1) : prev.ausentes
 };
 });
 } catch (err) {
 console.error('Error parseando mensaje SSE:', err);
 }
 };

 eventSource.onerror = (err) => {
 console.error('Error en conexión SSE:', err);
 setConnectionStatus('desconectado');
 };

 return () => {
 eventSource.close();
 };
 }, []);

 const getTipoBadge = (tipo: string) => {
 switch (tipo) {
 case 'ENTRADA':
 return <span className="badge badge-success">Entrada</span>;
 case 'BREAK_IN':
 return <span className="badge badge-warning">Inicio Break</span>;
 case 'BREAK_OUT':
 return <span className="badge badge-info">Fin Break</span>;
 case 'SALIDA':
 return <span className="badge badge-success" style={{ filter: 'hue-rotate(90deg)' }}>Salida</span>;
 default:
 return <span className="badge">{tipo}</span>;
 }
 };

 const getEstadoBadge = (estado: string) => {
 switch (estado) {
 case 'PUNTUAL':
 return <span className="badge badge-success">Puntual</span>;
 case 'TARDANZA':
 return <span className="badge badge-error">Tardanza</span>;
 case 'CORRECTO':
 return <span className="badge badge-info">Correcto</span>;
 default:
 return <span className="badge">{estado}</span>;
 }
 };

 return (
 <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
 
 {/* Encabezado */}
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <div>
 <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '6px' }}>Dashboard de Asistencia</h1>
 <p style={{ color: 'var(--text-secondary)' }}>Seguimiento en tiempo real de accesos y reconocimiento facial.</p>
 </div>
 <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px' }}>
 <span className="live-indicator" style={{ backgroundColor: connectionStatus === 'conectado' ? 'var(--accent-success)' : 'var(--accent-error)' }}></span>
 <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
 Hikvision: {connectionStatus === 'conectado' ? 'ONLINE (ESCUCHANDO)' : 'CONECTANDO...'}
 </span>
 </div>
 </div>

 {/* Grid de Estadísticas */}
 <div style={{
 display: 'grid',
 gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
 gap: '20px'
 }}>
 <div className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
 <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Personal Total</div>
 <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', color: 'var(--text-primary)' }}>{stats.totalTrabajadores}</div>
 <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', fontSize: '5rem', opacity: 0.03, fontWeight: 900 }}></div>
 </div>

 <div className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
 <div style={{ color: 'var(--accent-success)', fontSize: '0.9rem', fontWeight: 500 }}>Entradas Hoy</div>
 <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', color: 'var(--accent-success)' }}>{stats.totalEntradasHoy}</div>
 <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', fontSize: '5rem', opacity: 0.03, fontWeight: 900 }}></div>
 </div>

 <div className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
 <div style={{ color: 'var(--accent-error)', fontSize: '0.9rem', fontWeight: 500 }}>Tardanzas Hoy</div>
 <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', color: 'var(--accent-error)' }}>{stats.totalTardanzasHoy}</div>
 <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', fontSize: '5rem', opacity: 0.03, fontWeight: 900 }}></div>
 </div>

 <div className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
 <div style={{ color: 'var(--accent-warning)', fontSize: '0.9rem', fontWeight: 500 }}>Breaks Activos</div>
 <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', color: 'var(--accent-warning)' }}>{stats.totalBreaksActivos}</div>
 <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', fontSize: '5rem', opacity: 0.03, fontWeight: 900 }}></div>
 </div>

 <div className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
 <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Ausentes Hoy</div>
 <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', color: 'var(--text-secondary)' }}>{stats.ausentes}</div>
 <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', fontSize: '5rem', opacity: 0.03, fontWeight: 900 }}></div>
 </div>
 </div>

 {/* Feed en Tiempo Real y Marcaciones */}
 <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
 
 <div className="glass-panel" style={{ padding: '24px' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
 <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Feed de Marcaciones en Tiempo Real</h3>
 <button className="btn btn-secondary" onClick={fetchStats} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Actualizar</button>
 </div>

 {logs.length === 0 ? (
 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
 <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}></div>
 <p>No hay marcaciones registradas para el día de hoy.</p>
 <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Usa el simulador para realizar marcaciones de prueba.</p>
 </div>
 ) : (
 <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
 {logs.map((log) => (
 <div 
 key={log.id} 
 className="glass-panel animate-slide-in" 
 style={{ 
 padding: '16px', 
 display: 'flex', 
 alignItems: 'center', 
 justifyContent: 'space-between',
 gap: '20px',
 borderColor: log.tipo === 'ENTRADA' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15,23,42,0.06)'
 }}
 >
 <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
 {/* Foto o Avatar */}
 <div style={{ 
 width: '50px', 
 height: '50px', 
 borderRadius: '12px', 
 overflow: 'hidden', 
 border: '1px solid rgba(15,23,42,0.1)',
 backgroundColor: 'rgba(15,23,42,0.02)',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center'
 }}>
 {log.foto_scan_url && log.foto_scan_url !== 'manual' ? (
 <img 
 src={`${log.foto_scan_url}`} 
 alt="Face capture" 
 style={{ width: '100%', height: '100%', objectFit: 'cover' }}
 onError={(e) => {
 // Si falla la carga de la foto tomada (ej: simulador), usar avatar por defecto
 (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(log.nombre_trabajador)}`;
 }}
 />
 ) : (
 <img 
 src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(log.nombre_trabajador)}`} 
 alt="Initials Avatar" 
 style={{ width: '100%', height: '100%' }}
 />
 )}
 </div>

 {/* Información */}
 <div>
 <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>{log.nombre_trabajador}</h4>
 <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '10px', marginTop: '2px' }}>
 <span>ID: {log.employee_no}</span>
 <span>•</span>
 <span>Hora: <strong>{log.hora}</strong></span>
 </p>
 </div>
 </div>

 {/* Estado / Tipo */}
 <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
 {getTipoBadge(log.tipo)}
 {getEstadoBadge(log.estado)}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 </div>
 </div>
 );
}
