import React, { useEffect, useState } from 'react';

interface Schedule {
  id: number;
  nombre: string;
  hora_entrada: string;
  hora_salida: string;
}

interface Worker {
  id: number;
  nombre: string;
  employee_no: string;
  card_no?: string;
  foto_url?: string;
  horario_id?: number;
  horario_nombre?: string;
  hora_entrada?: string;
  hora_salida?: string;
}

export default function WorkersPanel() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  
  // Form states
  const [name, setName] = useState('');
  const [employeeNo, setEmployeeNo] = useState('');
  const [cardNo, setCardNo] = useState('');
  const [scheduleId, setScheduleId] = useState<number | ''>('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // Cargar trabajadores
      const resWorkers = await fetch('http://localhost:5000/api/v1/admin/trabajadores');
      const dataWorkers = await resWorkers.json();
      
      // Cargar horarios
      const resSchedules = await fetch('http://localhost:5000/api/v1/admin/horarios');
      const dataSchedules = await resSchedules.json();

      if (dataWorkers.success && dataSchedules.success) {
        setWorkers(dataWorkers.trabajadores);
        setSchedules(dataSchedules.horarios);
      } else {
        setError('Error al decodificar respuestas de la API.');
      }
    } catch (err) {
      setError('No se pudo conectar al servidor local en el puerto 5000.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingWorker(null);
    setName('');
    setEmployeeNo('');
    setCardNo('');
    setScheduleId('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (worker: Worker) => {
    setEditingWorker(worker);
    setName(worker.nombre);
    setEmployeeNo(worker.employee_no);
    setCardNo(worker.card_no || '');
    setScheduleId(worker.horario_id || '');
    setIsModalOpen(true);
  };

  const handleSaveWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !employeeNo) {
      alert('El Nombre y el Número de Empleado son obligatorios.');
      return;
    }

    const payload = {
      nombre: name,
      employee_no: employeeNo,
      card_no: cardNo || null,
      horario_id: scheduleId ? Number(scheduleId) : null
    };

    try {
      const url = editingWorker 
        ? `http://localhost:5000/api/v1/admin/trabajadores/${editingWorker.id}` 
        : 'http://localhost:5000/api/v1/admin/trabajadores';
      
      const method = editingWorker ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        setIsModalOpen(false);
        fetchData();
      } else {
        alert(result.message || 'Error guardando trabajador.');
      }
    } catch (err) {
      alert('Error en conexión con el backend.');
    }
  };

  const handleDeleteWorker = async (id: number) => {
    if (!confirm('¿Estás seguro de que querés eliminar a este trabajador? Sus marcaciones se mantendrán pero perderás su perfil.')) {
      return;
    }
    
    try {
      const response = await fetch(`http://localhost:5000/api/v1/admin/trabajadores/${id}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (result.success) {
        fetchData();
      } else {
        alert(result.message);
      }
    } catch (err) {
      alert('Error eliminando trabajador.');
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
      
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '6px' }}>Gestión de Trabajadores</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Administrá el personal y asignale sus horarios correspondientes.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreateModal}>
          ➕ Registrar Trabajador
        </button>
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: '16px', borderColor: 'var(--accent-error)', color: '#f87171', display: 'flex', gap: '10px' }}>
          ⚠️ <strong>Error:</strong> {error}
        </div>
      )}

      {/* Panel Listado */}
      <div className="glass-panel" style={{ padding: '24px', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '40px 0', textTransform: 'uppercase', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600, letterSpacing: '0.1em' }}>
            Cargando base de datos...
          </div>
        ) : workers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: '2.5rem', marginBottom: '10px' }}>👥</p>
            <p>No hay trabajadores registrados en la base de datos.</p>
            <button className="btn btn-primary" onClick={handleOpenCreateModal} style={{ marginTop: '14px' }}>Crear el primero</button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Trabajador</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>ID Hikvision</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Nº Tarjeta</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Horario Asignado</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((worker) => (
                <tr key={worker.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {/* Avatar */}
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <img 
                        src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(worker.nombre)}`} 
                        alt="Avatar" 
                        style={{ width: '100%', height: '100%' }}
                      />
                    </div>
                    <span style={{ fontWeight: 600 }}>{worker.nombre}</span>
                  </td>
                  <td style={{ padding: '16px', fontWeight: 'bold', color: 'var(--accent-info)' }}>{worker.employee_no}</td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{worker.card_no || '—'}</td>
                  <td style={{ padding: '16px' }}>
                    {worker.horario_nombre ? (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 500 }}>{worker.horario_nombre}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{worker.hora_entrada} - {worker.hora_salida}</span>
                      </div>
                    ) : (
                      <span className="badge badge-error" style={{ fontSize: '0.7rem' }}>Sin Horario</span>
                    )}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary" onClick={() => handleOpenEditModal(worker)} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                        ✏️ Editar
                      </button>
                      <button className="btn btn-danger" onClick={() => handleDeleteWorker(worker.id)} style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171' }}>
                        🗑️ Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal - Registrar/Editar Trabajador */}
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
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.12)'
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '20px' }}>
              {editingWorker ? '✏️ Editar Trabajador' : '👤 Registrar Trabajador'}
            </h3>

            <form onSubmit={handleSaveWorker} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Nombre Completo</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: Daniel Rossi" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>ID Hikvision (employeeNoString)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Debe coincidir con el ID registrado en el dispositivo facial (Ej: 1)" 
                  value={employeeNo} 
                  onChange={(e) => setEmployeeNo(e.target.value)} 
                  required
                  disabled={!!editingWorker} // El ID en el Hikvision no debería cambiarse a la ligera
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Es crucial que este ID sea exactamente el mismo que tiene configurado en la tablet Hikvision.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Número de Tarjeta (Opcional)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: 901234 (RFID)" 
                  value={cardNo} 
                  onChange={(e) => setCardNo(e.target.value)} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Horario Laboral</label>
                <select 
                  className="form-input" 
                  value={scheduleId} 
                  onChange={(e) => setScheduleId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">-- Sin Horario (No marcará asistencia) --</option>
                  {schedules.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      {schedule.nombre} ({schedule.hora_entrada} - {schedule.hora_salida})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
