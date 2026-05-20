import { Router, Request, Response, RequestHandler } from 'express';
import { getDb } from '../db/database';
import { liveEvents } from './hikvisionListener';

const router = Router();

/**
 * SSE (Server-Sent Events) - Stream en tiempo real para el Dashboard
 * GET /api/v1/admin/live-feed
 */
const getLiveFeed: RequestHandler = (req: Request, res: Response): void => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Enviar headers de inmediato

  console.log('[SSE] Cliente conectado al feed en tiempo real.');

  const onNewScan = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  liveEvents.on('new-scan', onNewScan);

  // Mantener vivo el canal enviando pings periódicos cada 20 segundos
  const keepAlive = setInterval(() => {
    res.write(': ping\n\n');
  }, 20000);

  req.on('close', () => {
    console.log('[SSE] Cliente desconectado.');
    liveEvents.off('new-scan', onNewScan);
    clearInterval(keepAlive);
  });
};

router.get('/live-feed', getLiveFeed);

/**
 * ESTADÍSTICAS DEL DASHBOARD
 * GET /api/v1/admin/dashboard-stats
 */
const getDashboardStats: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    
    // Obtener la fecha de hoy local "YYYY-MM-DD"
    const today = new Date().toISOString().substring(0, 10);

    // 1. Trabajadores registrados
    const rowWorkers = await db.get('SELECT COUNT(*) as count FROM trabajadores');
    const totalTrabajadores = rowWorkers ? (rowWorkers as any).count : 0;

    // 2. Horarios registrados
    const rowHorarios = await db.get('SELECT COUNT(*) as count FROM horarios');
    const totalHorarios = rowHorarios ? (rowHorarios as any).count : 0;

    // 3. Entradas registradas hoy
    const rowEntradas = await db.get(
      "SELECT COUNT(*) as count FROM marcaciones WHERE fecha = ? AND tipo = 'ENTRADA'",
      today
    );
    const totalEntradasHoy = rowEntradas ? (rowEntradas as any).count : 0;

    // 4. Tardanzas hoy
    const rowTardanzas = await db.get(
      "SELECT COUNT(*) as count FROM marcaciones WHERE fecha = ? AND tipo = 'ENTRADA' AND estado = 'TARDANZA'",
      today
    );
    const totalTardanzasHoy = rowTardanzas ? (rowTardanzas as any).count : 0;

    // 5. Breaks activos hoy (Trabajadores que salieron a break pero no han vuelto)
    // Contamos personas que tienen BREAK_IN pero no BREAK_OUT hoy
    const activeBreaks = await db.all(`
      SELECT t.id, t.nombre 
      FROM trabajadores t
      JOIN marcaciones m1 ON t.id = m1.trabajador_id AND m1.fecha = ? AND m1.tipo = 'BREAK_IN'
      WHERE NOT EXISTS (
        SELECT 1 FROM marcaciones m2 
        WHERE t.id = m2.trabajador_id AND m2.fecha = ? AND m2.tipo = 'BREAK_OUT'
      )
    `, today, today);
    const totalBreaksActivos = activeBreaks.length;

    // 6. Faltas/Ausentes hoy (Trabajadores activos que no marcaron entrada)
    const ausentes = totalTrabajadores - totalEntradasHoy;

    // 7. Marcaciones recientes de hoy (últimas 10)
    const logsRecientes = await db.all(`
      SELECT m.id, m.fecha, m.hora, m.tipo, m.estado, m.foto_scan_url, t.nombre as nombre_trabajador, t.employee_no
      FROM marcaciones m
      JOIN trabajadores t ON m.trabajador_id = t.id
      WHERE m.fecha = ?
      ORDER BY m.id DESC
      LIMIT 10
    `, today);

    res.status(200).json({
      success: true,
      stats: {
        totalTrabajadores,
        totalHorarios,
        totalEntradasHoy,
        totalTardanzasHoy,
        totalBreaksActivos,
        ausentes: ausentes < 0 ? 0 : ausentes
      },
      logsRecientes
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas del dashboard:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

router.get('/dashboard-stats', getDashboardStats);

/**
 * HISTORIAL Y REPORTE DE MARCACIONES
 * GET /api/v1/admin/marcaciones
 */
const getMarcaciones: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const { startDate, endDate, trabajadorId, tipo, estado } = req.query;

    let query = `
      SELECT m.id, m.fecha, m.hora, m.tipo, m.estado, m.foto_scan_url, t.nombre as nombre_trabajador, t.employee_no
      FROM marcaciones m
      JOIN trabajadores t ON m.trabajador_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate) {
      query += ` AND m.fecha >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND m.fecha <= ?`;
      params.push(endDate);
    }
    if (trabajadorId) {
      query += ` AND m.trabajador_id = ?`;
      params.push(Number(trabajadorId));
    }
    if (tipo) {
      query += ` AND m.tipo = ?`;
      params.push(tipo);
    }
    if (estado) {
      query += ` AND m.estado = ?`;
      params.push(estado);
    }

    query += ` ORDER BY m.fecha DESC, m.hora DESC LIMIT 200`;

    const marcaciones = await db.all(query, ...params);
    res.status(200).json({ success: true, marcaciones });
  } catch (error) {
    console.error('Error obteniendo marcaciones:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

router.get('/marcaciones', getMarcaciones);

/**
 * CREAR MARCACIÓN MANUAL (Corrección administrativa)
 * POST /api/v1/admin/marcaciones/manual
 */
const createManualMarcacion: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const { trabajador_id, fecha, hora, tipo, estado } = req.body;

    if (!trabajador_id || !fecha || !hora || !tipo || !estado) {
      res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
      return;
    }

    const result = await db.run(`
      INSERT INTO marcaciones (trabajador_id, fecha, hora, tipo, estado, foto_scan_url)
      VALUES (?, ?, ?, ?, ?, 'manual')
    `, trabajador_id, fecha, hora, tipo, estado);

    // Obtener info del trabajador para notificar al dashboard
    const trabajador = await db.get('SELECT nombre, employee_no FROM trabajadores WHERE id = ?', trabajador_id);

    const logRecord = {
      id: result.lastID,
      trabajador_id,
      nombre_trabajador: trabajador.nombre,
      employee_no: trabajador.employee_no,
      fecha,
      hora,
      tipo,
      estado,
      foto_scan_url: 'manual'
    };

    liveEvents.emit('new-scan', logRecord);

    res.status(201).json({ success: true, message: 'Marcación manual registrada', id: result.lastID });
  } catch (error) {
    console.error('Error registrando marcación manual:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

router.post('/marcaciones/manual', createManualMarcacion);

/**
 * CRUD TRABAJADORES
 */
const getTrabajadores: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const list = await db.all(`
      SELECT t.*, h.nombre as horario_nombre, h.hora_entrada, h.hora_salida
      FROM trabajadores t
      LEFT JOIN horarios h ON t.horario_id = h.id
      ORDER BY t.nombre ASC
    `);
    res.status(200).json({ success: true, trabajadores: list });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error obteniendo trabajadores' });
  }
};

const createTrabajador: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const { nombre, employee_no, card_no, foto_url, horario_id } = req.body;

    if (!nombre || !employee_no) {
      res.status(400).json({ success: false, message: 'Nombre y Número de Empleado son requeridos' });
      return;
    }

    // Verificar si el employee_no ya existe
    const exists = await db.get('SELECT id FROM trabajadores WHERE employee_no = ?', employee_no);
    if (exists) {
      res.status(400).json({ success: false, message: `El Número de Empleado ${employee_no} ya existe` });
      return;
    }

    const result = await db.run(`
      INSERT INTO trabajadores (nombre, employee_no, card_no, foto_url, horario_id)
      VALUES (?, ?, ?, ?, ?)
    `, nombre, employee_no, card_no || null, foto_url || null, horario_id || null);

    res.status(201).json({ success: true, message: 'Trabajador creado exitosamente', id: result.lastID });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creando trabajador' });
  }
};

const updateTrabajador: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { nombre, employee_no, card_no, foto_url, horario_id } = req.body;

    if (!nombre || !employee_no) {
      res.status(400).json({ success: false, message: 'Nombre y Número de Empleado son requeridos' });
      return;
    }

    // Verificar duplicado de employee_no
    const exists = await db.get('SELECT id FROM trabajadores WHERE employee_no = ? AND id != ?', employee_no, Number(id));
    if (exists) {
      res.status(400).json({ success: false, message: `El Número de Empleado ${employee_no} ya está en uso` });
      return;
    }

    await db.run(`
      UPDATE trabajadores 
      SET nombre = ?, employee_no = ?, card_no = ?, foto_url = ?, horario_id = ?
      WHERE id = ?
    `, nombre, employee_no, card_no || null, foto_url || null, horario_id || null, Number(id));

    res.status(200).json({ success: true, message: 'Trabajador actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error actualizando trabajador' });
  }
};

const deleteTrabajador: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const { id } = req.params;
    await db.run('DELETE FROM trabajadores WHERE id = ?', Number(id));
    res.status(200).json({ success: true, message: 'Trabajador eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error eliminando trabajador' });
  }
};

router.get('/trabajadores', getTrabajadores);
router.post('/trabajadores', createTrabajador);
router.put('/trabajadores/:id', updateTrabajador);
router.delete('/trabajadores/:id', deleteTrabajador);

/**
 * CRUD HORARIOS
 */
const getHorarios: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const list = await db.all('SELECT * FROM horarios ORDER BY nombre ASC');
    res.status(200).json({ success: true, horarios: list });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error obteniendo horarios' });
  }
};

const createHorario: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const { nombre, hora_entrada, hora_salida, minutos_tolerancia, break_duracion } = req.body;

    if (!nombre || !hora_entrada || !hora_salida) {
      res.status(400).json({ success: false, message: 'Nombre, Entrada y Salida son requeridos' });
      return;
    }

    const result = await db.run(`
      INSERT INTO horarios (nombre, hora_entrada, hora_salida, minutos_tolerancia, break_duracion)
      VALUES (?, ?, ?, ?, ?)
    `, nombre, hora_entrada, hora_salida, minutos_tolerancia || 0, break_duracion || 60);

    res.status(201).json({ success: true, message: 'Horario creado exitosamente', id: result.lastID });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creando horario' });
  }
};

const updateHorario: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { nombre, hora_entrada, hora_salida, minutos_tolerancia, break_duracion } = req.body;

    if (!nombre || !hora_entrada || !hora_salida) {
      res.status(400).json({ success: false, message: 'Nombre, Entrada y Salida son requeridos' });
      return;
    }

    await db.run(`
      UPDATE horarios
      SET nombre = ?, hora_entrada = ?, hora_salida = ?, minutos_tolerancia = ?, break_duracion = ?
      WHERE id = ?
    `, nombre, hora_entrada, hora_salida, minutos_tolerancia || 0, break_duracion || 60, Number(id));

    res.status(200).json({ success: true, message: 'Horario actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error actualizando horario' });
  }
};

const deleteHorario: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const { id } = req.params;
    
    // Verificar si hay trabajadores asignados a este horario
    const assigned = await db.get('SELECT COUNT(*) as count FROM trabajadores WHERE horario_id = ?', Number(id));
    if (assigned && (assigned as any).count > 0) {
      res.status(400).json({ 
        success: false, 
        message: 'No se puede eliminar el horario porque está asignado a uno o más trabajadores' 
      });
      return;
    }

    await db.run('DELETE FROM horarios WHERE id = ?', Number(id));
    res.status(200).json({ success: true, message: 'Horario eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error eliminando horario' });
  }
};

router.get('/horarios', getHorarios);
router.post('/horarios', createHorario);
router.put('/horarios/:id', updateHorario);
router.delete('/horarios/:id', deleteHorario);

export default router;
