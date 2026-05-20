import React, { useState } from 'react';
import DashboardHome from './components/DashboardHome';
import WorkersPanel from './components/WorkersPanel';
import SchedulesPanel from './components/SchedulesPanel';
import ReportsPanel from './components/ReportsPanel';

type ActiveView = 'dashboard' | 'trabajadores' | 'horarios' | 'reportes';

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');

  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardHome />;
      case 'trabajadores':
        return <WorkersPanel />;
      case 'horarios':
        return <SchedulesPanel />;
      case 'reportes':
        return <ReportsPanel />;
      default:
        return <DashboardHome />;
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)'
    }}>
      
      {/* Sidebar de Navegación Lateral */}
      <aside className="glass-panel" style={{
        width: '280px',
        padding: '30px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '40px',
        borderRadius: '0 var(--border-radius-lg) var(--border-radius-lg) 0',
        borderLeft: 'none',
        borderTop: 'none',
        borderBottom: 'none',
        height: '100vh',
        position: 'sticky',
        top: 0
      }}>
        {/* Identidad / Logo */}
        {/* Identidad / Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '10px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255, 255, 255, 0.1)'
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
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <button 
            className={`btn ${activeView === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveView('dashboard')}
            style={{ 
              justifyContent: 'flex-start', 
              padding: '12px 16px', 
              fontSize: '0.9rem',
              borderRadius: '8px',
              border: activeView === 'dashboard' ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
              background: activeView === 'dashboard' ? 'var(--accent-primary)' : 'transparent',
              boxShadow: 'none'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px', flexShrink: 0 }}>
              <rect x="3" y="3" width="7" height="9" rx="1"></rect>
              <rect x="14" y="3" width="7" height="5" rx="1"></rect>
              <rect x="14" y="12" width="7" height="9" rx="1"></rect>
              <rect x="3" y="16" width="7" height="5" rx="1"></rect>
            </svg>
            Dashboard Real-Time
          </button>
          
          <button 
            className={`btn ${activeView === 'trabajadores' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveView('trabajadores')}
            style={{ 
              justifyContent: 'flex-start', 
              padding: '12px 16px', 
              fontSize: '0.9rem',
              borderRadius: '8px',
              border: activeView === 'trabajadores' ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
              background: activeView === 'trabajadores' ? 'var(--accent-primary)' : 'transparent',
              boxShadow: 'none'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px', flexShrink: 0 }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Trabajadores
          </button>

          <button 
            className={`btn ${activeView === 'horarios' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveView('horarios')}
            style={{ 
              justifyContent: 'flex-start', 
              padding: '12px 16px', 
              fontSize: '0.9rem',
              borderRadius: '8px',
              border: activeView === 'horarios' ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
              background: activeView === 'horarios' ? 'var(--accent-primary)' : 'transparent',
              boxShadow: 'none'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px', flexShrink: 0 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            Configurar Horarios
          </button>

          <button 
            className={`btn ${activeView === 'reportes' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveView('reportes')}
            style={{ 
              justifyContent: 'flex-start', 
              padding: '12px 16px', 
              fontSize: '0.9rem',
              borderRadius: '8px',
              border: activeView === 'reportes' ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
              background: activeView === 'reportes' ? 'var(--accent-primary)' : 'transparent',
              boxShadow: 'none'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px', flexShrink: 0 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Historial & Reportes
          </button>
        </nav>

        {/* Footer del Sidebar */}
        <div style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          paddingTop: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hikvision HK-DS-K1T320EFWX-B</div>
          <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Conexión Directa UDP/HTTP</div>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main style={{
        flex: 1,
        padding: '40px',
        overflowY: 'auto',
        maxHeight: '100vh'
      }}>
        {renderActiveView()}
      </main>

    </div>
  );
}
