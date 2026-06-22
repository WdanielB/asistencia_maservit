import React, { useState } from 'react';
import DashboardHome from './components/DashboardHome';
import WorkersPanel from './components/WorkersPanel';
import SchedulesPanel from './components/SchedulesPanel';
import ReportsPanel from './components/ReportsPanel';
import PersonalDashboard from './components/PersonalDashboard';
import LiveCamera from './components/LiveCamera';
import SettingsPanel from './components/SettingsPanel';

type ActiveView = 'dashboard' | 'personal' | 'trabajadores' | 'horarios' | 'reportes' | 'camara' | 'config';

interface NavItemProps {
 active: boolean;
 onClick: () => void;
 label: string;
 children: React.ReactNode; // icono SVG
}

const NavItem: React.FC<NavItemProps> = ({ active, onClick, label, children }) => (
 <button
 className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
 onClick={onClick}
 style={{
 justifyContent: 'flex-start',
 padding: '12px 16px',
 fontSize: '0.9rem',
 borderRadius: '8px',
 border: active ? 'none' : '1px solid rgba(15, 23, 42, 0.05)',
 background: active ? 'var(--accent-primary)' : 'transparent',
 boxShadow: 'none',
 }}
 >
 <span style={{ marginRight: '10px', flexShrink: 0, display: 'inline-flex' }}>{children}</span>
 {label}
 </button>
);

const ic = {
 stroke: 'currentColor' as const,
 width: 18,
 height: 18,
 viewBox: '0 0 24 24',
 fill: 'none',
 strokeWidth: 2.2,
 strokeLinecap: 'round' as const,
 strokeLinejoin: 'round' as const,
};

export default function App() {
 const [activeView, setActiveView] = useState<ActiveView>('dashboard');

 const renderActiveView = () => {
 switch (activeView) {
 case 'dashboard': return <DashboardHome />;
 case 'personal': return <PersonalDashboard />;
 case 'trabajadores': return <WorkersPanel />;
 case 'horarios': return <SchedulesPanel />;
 case 'reportes': return <ReportsPanel />;
 case 'camara': return <LiveCamera />;
 case 'config': return <SettingsPanel />;
 default: return <DashboardHome />;
 }
 };

 return (
 <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
 {/* Sidebar de Navegación Lateral */}
 <aside className="glass-panel" style={{
 width: '280px', padding: '30px 20px', display: 'flex', flexDirection: 'column', gap: '32px',
 borderRadius: '0 var(--border-radius-lg) var(--border-radius-lg) 0',
 borderLeft: 'none', borderTop: 'none', borderBottom: 'none',
 height: '100vh', position: 'sticky', top: 0,
 }}>
 {/* Identidad / Logo */}
 <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '10px' }}>
 <div style={{
 width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent-primary)',
 display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(15, 23, 42, 0.1)',
 }}>
 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#fff' }}>
 <circle cx="12" cy="12" r="10"></circle>
 <polyline points="12 6 12 12 16 14"></polyline>
 </svg>
 </div>
 <div>
 <h2 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--text-primary)' }}>MASERVIT</h2>
 <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>ASISTENCIA</span>
 </div>
 </div>

 {/* Menú de Opciones */}
 <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
 <NavItem active={activeView === 'dashboard'} onClick={() => setActiveView('dashboard')} label="Dashboard Real-Time">
 <svg xmlns="http://www.w3.org/2000/svg" {...ic}><rect x="3" y="3" width="7" height="9" rx="1"></rect><rect x="14" y="3" width="7" height="5" rx="1"></rect><rect x="14" y="12" width="7" height="9" rx="1"></rect><rect x="3" y="16" width="7" height="5" rx="1"></rect></svg>
 </NavItem>
 <NavItem active={activeView === 'personal'} onClick={() => setActiveView('personal')} label="Control de Personal">
 <svg xmlns="http://www.w3.org/2000/svg" {...ic}><path d="M3 3v18h18"></path><rect x="7" y="10" width="3" height="8"></rect><rect x="12" y="6" width="3" height="12"></rect><rect x="17" y="13" width="3" height="5"></rect></svg>
 </NavItem>
 <NavItem active={activeView === 'camara'} onClick={() => setActiveView('camara')} label="Cámara en Vivo">
 <svg xmlns="http://www.w3.org/2000/svg" {...ic}><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
 </NavItem>
 <NavItem active={activeView === 'trabajadores'} onClick={() => setActiveView('trabajadores')} label="Trabajadores">
 <svg xmlns="http://www.w3.org/2000/svg" {...ic}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
 </NavItem>
 <NavItem active={activeView === 'horarios'} onClick={() => setActiveView('horarios')} label="Configurar Horarios">
 <svg xmlns="http://www.w3.org/2000/svg" {...ic}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
 </NavItem>
 <NavItem active={activeView === 'reportes'} onClick={() => setActiveView('reportes')} label="Historial & Reportes">
 <svg xmlns="http://www.w3.org/2000/svg" {...ic}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
 </NavItem>
 <NavItem active={activeView === 'config'} onClick={() => setActiveView('config')} label="Configuración">
 <svg xmlns="http://www.w3.org/2000/svg" {...ic}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
 </NavItem>
 </nav>

 {/* Footer del Sidebar */}
 <div style={{ borderTop: '1px solid rgba(15, 23, 42, 0.05)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
 <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hikvision DS-K1T320EFX</div>
 <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Conexión Directa HTTP/ISAPI</div>
 </div>
 </aside>

 {/* Contenido Principal */}
 <main style={{ flex: 1, padding: '40px', overflowY: 'auto', maxHeight: '100vh' }}>
 {renderActiveView()}
 </main>
 </div>
 );
}
