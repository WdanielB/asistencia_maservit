import React, { useEffect, useState } from 'react';

interface Schedule {
  id: number;
  nombre: string;
  hora_entrada: string;
  hora_salida: string;
  minutos_tolerancia: number;
  break_duracion: number;
}

export default function SchedulesPanel() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [inTime, setInTime] = useState('08:00');
  const [outTime, setOutTime] = useState('17:00');
  const [tolerance, setTolerance] = useState(15);
  const [breakDuration, setBreakDuration] = useState(60);

  const fetchSchedules = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:5000/api/v1/admin/horarios');
      const data = await response.json();
      if (data.success) {
        setSchedules(data.horarios);
      } else {
        setError('Error al decodificar respuesta del servidor.');
      }
    } catch (err) {
      setError('No se pudo conectar al servidor local en el puerto 5000.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingSchedule(null);
    setName('');
    setInTime('08:00');
    setOutTime('17:00');
    setTolerance(15);
    setBreakDuration(60);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setName(schedule.nombre);
    setInTime(schedule.hora_entrada);
    setOutTime(schedule.hora_salida);
    setTolerance(schedule.minutos_tolerancia);
    setBreakDuration(schedule.break_duracion);
    setIsModalOpen(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !inTime || !outTime) {
      alert('Por favor completa los campos obligatorios.');
      return;
    }

    const payload = {
      nombre: name,
      hora_entrada: inTime,
      hora_salida: outTime,
      minutos_tolerancia: Number(tolerance),
      break_duracion: Number(breakDuration)
    };

    try {
      const url = editingSchedule 
        ? `http://localhost:5000/api/v1/admin/horarios/${editingSchedule.id}` 
        : 'http://localhost:5000/api/v1/admin/horarios';
      
      const method = editingSchedule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        setIsModalOpen(false);
        fetchSchedules();
      } else {
        alert(result.message || 'Error guardando el horario.');
      }
    } catch (err) {
      alert('Error de conexión con el backend.');
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    if (!confirm('¿Estás seguro de que querés eliminar este turno? Recordá que no debe estar asignado a ningún trabajador activo.')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/v1/admin/horarios/${id}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (result.success) {
        fetchSchedules();
      } else {
        alert(result.message || 'Error al eliminar el turno.');
      }
    } catch (err) {
      alert('Error de conexión.');
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
      
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '6px' }}>Configuración de Horarios</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Definí las horas de entrada, salida, breaks y tolerancia para los trabajadores.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreateModal}>
          ➕ Nuevo Horario
        </button>
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: '16px', borderColor: 'var(--accent-error)', color: '#f87171' }}>
          ⚠️ <strong>Error:</strong> {error}
        </div>
      )}

      {/* Grid de Horarios */}
      {loading ? (
        <div style={{ padding: '40px 0', textTransform: 'uppercase', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600, letterSpacing: '0.1em' }}>
          Cargando horarios...
        </div>
      ) : schedules.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📅</p>
          <p>No hay horarios configurados aún.</p>
          <button className="btn btn-primary" onClick={handleOpenCreateModal} style={{ marginTop: '14px' }}>Configurar primer horario</button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px'
        }}>
          {schedules.map((schedule) => (
            <div key={schedule.id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{schedule.nombre}</h3>
                <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Horario Fijo</span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', margin: '8px 0' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Entrada</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>🚪 {schedule.hora_entrada}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Salida</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>🚗 {schedule.hora_salida}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Tolerancia</span>
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: '#fbbf24' }}>⏱️ {schedule.minutos_tolerancia} min</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Duración Break</span>
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: '#34d399' }}>☕ {schedule.break_duracion} min</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', marginTop: 'auto' }}>
                <button className="btn btn-secondary" onClick={() => handleOpenEditModal(schedule)} style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }}>
                  ✏️ Editar
                </button>
                <button className="btn btn-danger" onClick={() => handleDeleteSchedule(schedule.id)} style={{ flex: 1, padding: '8px', fontSize: '0.8rem', background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171' }}>
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal - Registrar/Editar Horario */}
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
              {editingSchedule ? '✏️ Editar Horario' : '📅 Crear Nuevo Horario'}
            </h3>

            <form onSubmit={handleSaveSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Nombre del Horario</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: Turno Mañana / Nocturno" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Hora de Entrada</label>
                  <input 
                    type="time" 
                    className="form-input" 
                    value={inTime} 
                    onChange={(e) => setInTime(e.target.value)} 
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Hora de Salida</label>
                  <input 
                    type="time" 
                    className="form-input" 
                    value={outTime} 
                    onChange={(e) => setOutTime(e.target.value)} 
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Minutos de Tolerancia</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    min="0" 
                    max="180" 
                    value={tolerance} 
                    onChange={(e) => setTolerance(Number(e.target.value))} 
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Duración Break (minutos)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    min="0" 
                    max="300" 
                    value={breakDuration} 
                    onChange={(e) => setBreakDuration(Number(e.target.value))} 
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar Horario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
