import { Router, Request, Response, RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getDb, getConfig, setConfig } from '../db/database';
import { liveEvents } from './hikvisionListener';
import { computeWorkerReport, PayConfig, CalcPunch, WorkerReport } from '../services/hoursCalculator';
import { getSnapshot, createDeviceUser, enrollFace, captureFingerprint, saveFingerprint, DeviceConfig } from '../services/deviceClient';

const router = Router();
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const facesDir = path.join(__dirname, '../../../public/uploads/faces');
if (!fs.existsSync(facesDir)) fs.mkdirSync(facesDir, { recursive: true });

/** Escapa y arma un CSV (separador ';' y BOM para Excel en español). */
function toCSV(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [headers.map(esc).join(';'), ...rows.map((r) => r.map(esc).join(';'))];
  return '﻿' + lines.join('\r\n');
}

function sendCSV(res: Response, filename: string, csv: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csv);
}

/** Construye la config de pago a partir de la tabla config. */
function toPayConfig(cfg: Record<string, string>): PayConfig {
  return {
    umbral_nueva_jornada_horas: Number(cfg.umbral_nueva_jornada_horas ?? 14),
    nocturno_inicio: cfg.nocturno_inicio ?? '22:00',
    nocturno_fin: cfg.nocturno_fin ?? '06:00',
    mult_nocturno: Number(cfg.mult_nocturno ?? 1.35),
    horas_jornada_normal: Number(cfg.horas_jornada_normal ?? 8),
    mult_extra: Number(cfg.mult_extra ?? 1.25),
  };
}

function deviceFromConfig(cfg: Record<string, string>): DeviceConfig {
  return {
    ip: cfg.device_ip ?? '192.168.0.16',
    user: cfg.device_user ?? 'admin',
    pass: cfg.device_pass ?? '',
  };
}

/** Calcula el reporte de horas/pago de un trabajador en un rango de fechas. */
async function reporteTrabajador(
  trabajadorId: number,
  startDate: string,
  endDate: string,
  payCfg: PayConfig,
  tarifa: number
): Promise<WorkerReport> {
  const db = await getDb();
  const startTs = new Date(`${startDate}T00:00:00`).getTime();
  // Buffer al final para no cortar sesiones que cruzan la medianoche
  const endTs = new Date(`${endDate}T23:59:59`).getTime() + 8 * 3600000;
  const rows = await db.all(
    `SELECT ts, tipo FROM marcaciones
     WHERE trabajador_id = ? AND ts IS NOT NULL AND ts >= ? AND ts <= ?
     ORDER BY ts ASC`,
    trabajadorId,
    new Date(startTs).toISOString(),
    new Date(endTs).toISOString()
  );
  const punches: CalcPunch[] = rows.map((r: any) => ({ ts: new Date(r.ts).getTime(), tipo: r.tipo }));
  const full = computeWorkerReport(punches, payCfg, tarifa);
  // Conservar solo las sesiones cuya entrada cae dentro del rango pedido
  const inRange = full.sessions.filter((s) => s.fecha >= startDate && s.fecha <= endDate);
  if (inRange.length === full.sessions.length) return full;
  return computeWorkerReport(
    punches.filter((p) => {
      const d = new Date(p.ts);
      const fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return fecha >= startDate && fecha <= `${endDate}`;
    }),
    payCfg,
    tarifa
  );
}

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
    const { nombre, employee_no, card_no, foto_url, horario_id, tarifa_hora, crear_en_dispositivo } = req.body;

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

    // Crear también en el terminal Hikvision (la cara/huella se enrola luego en el equipo)
    let deviceMsg = 'no solicitado';
    if (crear_en_dispositivo) {
      try {
        const cfg = await getConfig();
        const r = await createDeviceUser(deviceFromConfig(cfg), String(employee_no), nombre);
        deviceMsg = r.ok ? 'creado en el dispositivo' : `el dispositivo respondió: ${r.message}`;
        if (!r.ok) {
          res.status(502).json({ success: false, message: `No se pudo crear en el dispositivo: ${r.message}` });
          return;
        }
      } catch (e: any) {
        res.status(502).json({ success: false, message: `Error conectando al dispositivo: ${e.message}` });
        return;
      }
    }

    const result = await db.run(`
      INSERT INTO trabajadores (nombre, employee_no, card_no, foto_url, horario_id, tarifa_hora)
      VALUES (?, ?, ?, ?, ?, ?)
    `, nombre, employee_no, card_no || null, foto_url || null, horario_id || null, Number(tarifa_hora) || 0);

    res.status(201).json({ success: true, message: `Trabajador creado (${deviceMsg})`, id: result.lastID });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creando trabajador' });
  }
};

const updateTrabajador: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { nombre, employee_no, card_no, foto_url, horario_id, tarifa_hora } = req.body;

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
      SET nombre = ?, employee_no = ?, card_no = ?, foto_url = ?, horario_id = ?, tarifa_hora = ?
      WHERE id = ?
    `, nombre, employee_no, card_no || null, foto_url || null, horario_id || null, Number(tarifa_hora) || 0, Number(id));

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

/**
 * CONFIGURACIÓN GLOBAL DEL SISTEMA
 */
const getConfigHandler: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const cfg = await getConfig();
    // No exponer la contraseña del dispositivo en texto
    const safe = { ...cfg };
    if (safe.device_pass) safe.device_pass = '********';
    res.status(200).json({ success: true, config: safe });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error obteniendo configuración' });
  }
};

const updateConfigHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const updates = req.body || {};
    // Ignorar la contraseña enmascarada para no sobreescribirla con asteriscos
    if (updates.device_pass === '********') delete updates.device_pass;
    await setConfig(updates);
    res.status(200).json({ success: true, message: 'Configuración actualizada' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error actualizando configuración' });
  }
};

router.get('/config', getConfigHandler);
router.put('/config', updateConfigHandler);

/**
 * REPORTE DE HORAS Y PAGO — CONTROL DE PERSONAL
 * GET /api/v1/admin/reportes/horas?startDate=&endDate=&trabajadorId=
 */
const getReporteHoras: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const today = new Date().toISOString().substring(0, 10);
    const startDate = (req.query.startDate as string) || today;
    const endDate = (req.query.endDate as string) || today;
    const trabajadorId = req.query.trabajadorId ? Number(req.query.trabajadorId) : null;

    const cfg = await getConfig();
    const payCfg = toPayConfig(cfg);

    let workers = await db.all(
      `SELECT id, nombre, employee_no, foto_url, tarifa_hora FROM trabajadores
       ${trabajadorId ? 'WHERE id = ?' : ''} ORDER BY nombre ASC`,
      ...(trabajadorId ? [trabajadorId] : [])
    );

    const filas = [];
    for (const w of workers as any[]) {
      const rep = await reporteTrabajador(w.id, startDate, endDate, payCfg, Number(w.tarifa_hora) || 0);
      filas.push({
        trabajador_id: w.id,
        nombre: w.nombre,
        employee_no: w.employee_no,
        foto_url: w.foto_url,
        tarifa_hora: Number(w.tarifa_hora) || 0,
        ...rep,
      });
    }

    const totales = {
      totalTrabajadoH: round2(filas.reduce((a, f) => a + f.totalTrabajadoH, 0)),
      extraH: round2(filas.reduce((a, f) => a + f.extraH, 0)),
      nocturnasH: round2(filas.reduce((a, f) => a + f.nocturnasH, 0)),
      montoTotal: round2(filas.reduce((a, f) => a + f.montoTotal, 0)),
    };

    res.status(200).json({ success: true, moneda: cfg.moneda || 'S/', startDate, endDate, totales, trabajadores: filas });
  } catch (error) {
    console.error('Error en reporte de horas:', error);
    res.status(500).json({ success: false, message: 'Error generando reporte' });
  }
};

const round2 = (n: number) => Math.round(n * 100) / 100;

router.get('/reportes/horas', getReporteHoras);

/**
 * RESUMEN INDIVIDUAL DE UN TRABAJADOR (dashboard por trabajador)
 * GET /api/v1/admin/trabajadores/:id/resumen?startDate=&endDate=
 */
const getResumenTrabajador: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const id = Number(req.params.id);
    const today = new Date().toISOString().substring(0, 10);
    const startDate = (req.query.startDate as string) || today;
    const endDate = (req.query.endDate as string) || today;

    const worker = await db.get('SELECT id, nombre, employee_no, foto_url, tarifa_hora FROM trabajadores WHERE id = ?', id);
    if (!worker) {
      res.status(404).json({ success: false, message: 'Trabajador no encontrado' });
      return;
    }

    const cfg = await getConfig();
    const payCfg = toPayConfig(cfg);
    const rep = await reporteTrabajador(id, startDate, endDate, payCfg, Number((worker as any).tarifa_hora) || 0);

    res.status(200).json({
      success: true,
      moneda: cfg.moneda || 'S/',
      trabajador: worker,
      startDate,
      endDate,
      reporte: rep,
    });
  } catch (error) {
    console.error('Error en resumen de trabajador:', error);
    res.status(500).json({ success: false, message: 'Error generando resumen' });
  }
};

router.get('/trabajadores/:id/resumen', getResumenTrabajador);

/**
 * CÁMARA EN VIVO (proxy ISAPI)
 */
const getCamaraSnapshot: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const cfg = await getConfig();
    const jpg = await getSnapshot(deviceFromConfig(cfg));
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).end(jpg);
  } catch (e: any) {
    res.status(502).json({ success: false, message: `No se pudo obtener la imagen: ${e.message}` });
  }
};

const getCamaraStream: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const cfg = await getConfig();
  const dev = deviceFromConfig(cfg);
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    'Cache-Control': 'no-store',
    Connection: 'close',
  });

  let active = true;
  req.on('close', () => { active = false; });

  while (active) {
    try {
      const jpg = await getSnapshot(dev);
      if (!active) break;
      res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpg.length}\r\n\r\n`);
      res.write(jpg);
      res.write('\r\n');
    } catch (e) {
      break;
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  try { res.end(); } catch {}
};

router.get('/camara/snapshot', getCamaraSnapshot);
router.get('/camara/stream', getCamaraStream);

/**
 * ENROLAR ROSTRO desde una foto subida por la web.
 * POST /api/v1/admin/trabajadores/:id/enrolar-rostro  (multipart, campo "foto")
 */
const enrolarRostro: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const id = Number(req.params.id);
    const worker = await db.get('SELECT id, employee_no FROM trabajadores WHERE id = ?', id);
    if (!worker) { res.status(404).json({ success: false, message: 'Trabajador no encontrado' }); return; }
    if (!req.file) { res.status(400).json({ success: false, message: 'No se recibió la foto' }); return; }

    // Guardar la foto localmente para mostrarla en la app (siempre)
    const fileName = `emp_${(worker as any).employee_no}.jpg`;
    fs.writeFileSync(path.join(facesDir, fileName), req.file.buffer);
    const fotoUrl = `/uploads/faces/${fileName}`;
    await db.run('UPDATE trabajadores SET foto_url = ? WHERE id = ?', fotoUrl, id);

    // Enrolar el rostro en el terminal
    const cfg = await getConfig();
    let deviceMsg = 'no enrolado en el dispositivo';
    let deviceOk = false;
    try {
      const r = await enrollFace(deviceFromConfig(cfg), String((worker as any).employee_no), req.file.buffer);
      deviceOk = r.ok;
      deviceMsg = r.ok ? 'rostro enrolado en el dispositivo' : `el dispositivo respondió: ${r.message}`;
    } catch (e: any) {
      deviceMsg = `no se pudo contactar el dispositivo: ${e.message}`;
    }

    res.status(200).json({ success: true, foto_url: fotoUrl, deviceOk, message: `Foto guardada; ${deviceMsg}` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: `Error enrolando rostro: ${error.message}` });
  }
};

router.post('/trabajadores/:id/enrolar-rostro', memUpload.single('foto'), enrolarRostro);

/**
 * CAPTURAR HUELLA en el sensor del terminal (la persona debe poner el dedo).
 * POST /api/v1/admin/trabajadores/:id/capturar-huella  { fingerNo }
 */
const capturarHuella: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const id = Number(req.params.id);
    const fingerNo = Number(req.body?.fingerNo) || 1;
    const worker = await db.get('SELECT employee_no FROM trabajadores WHERE id = ?', id);
    if (!worker) { res.status(404).json({ success: false, message: 'Trabajador no encontrado' }); return; }

    const cfg = await getConfig();
    const dev = deviceFromConfig(cfg);
    const cap = await captureFingerprint(dev, fingerNo);
    if (!cap.ok) { res.status(502).json({ success: false, message: `Captura fallida: ${cap.message}` }); return; }

    const fingerData = cap.data?.CaptureFingerPrint?.fingerData;
    if (!fingerData) { res.status(502).json({ success: false, message: 'El dispositivo no devolvió la plantilla de huella' }); return; }

    const saved = await saveFingerprint(dev, String((worker as any).employee_no), fingerNo, fingerData);
    res.status(saved.ok ? 200 : 502).json({ success: saved.ok, message: saved.ok ? 'Huella registrada' : `No se pudo guardar: ${saved.message}` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: `Error capturando huella: ${error.message}` });
  }
};

router.post('/trabajadores/:id/capturar-huella', capturarHuella);

/**
 * EXPORTAR REPORTE DE HORAS/PAGO EN CSV
 * GET /api/v1/admin/reportes/horas.csv?startDate=&endDate=
 */
const exportHorasCSV: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const today = new Date().toISOString().substring(0, 10);
    const startDate = (req.query.startDate as string) || today;
    const endDate = (req.query.endDate as string) || today;
    const cfg = await getConfig();
    const payCfg = toPayConfig(cfg);
    const moneda = cfg.moneda || 'S/';

    const workers = await db.all('SELECT id, nombre, employee_no, tarifa_hora FROM trabajadores ORDER BY nombre ASC');
    const headers = ['Empleado', 'Nombre', 'Jornadas', 'Horas trabajadas', 'Refrigerio (h)', 'Dia normal (h)', 'Noche normal (h)', 'Dia extra (h)', 'Noche extra (h)', 'Extra total (h)', 'Nocturnas total (h)', `Tarifa/h (${moneda})`, `Monto (${moneda})`];
    const rows: (string | number)[][] = [];
    for (const w of workers as any[]) {
      const rep = await reporteTrabajador(w.id, startDate, endDate, payCfg, Number(w.tarifa_hora) || 0);
      if (rep.sesionesCount === 0) continue;
      rows.push([w.employee_no, w.nombre, rep.sesionesCount, rep.totalTrabajadoH, rep.totalRefrigerioH, rep.diaNormalH, rep.nocheNormalH, rep.diaExtraH, rep.nocheExtraH, rep.extraH, rep.nocturnasH, (Number(w.tarifa_hora) || 0).toFixed(2), rep.montoTotal.toFixed(2)]);
    }
    const csv = toCSV(headers, rows);
    sendCSV(res, `horas_${startDate}_a_${endDate}.csv`, csv);
  } catch (error: any) {
    res.status(500).json({ success: false, message: `Error exportando: ${error.message}` });
  }
};

/**
 * EXPORTAR MARCACIONES CRUDAS EN CSV
 * GET /api/v1/admin/marcaciones.csv?startDate=&endDate=&trabajadorId=
 */
const exportMarcacionesCSV: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const today = new Date().toISOString().substring(0, 10);
    const startDate = (req.query.startDate as string) || today;
    const endDate = (req.query.endDate as string) || today;
    const trabajadorId = req.query.trabajadorId ? Number(req.query.trabajadorId) : null;

    let q = `SELECT m.fecha, m.hora, t.employee_no, t.nombre, m.tipo, m.estado
             FROM marcaciones m JOIN trabajadores t ON m.trabajador_id = t.id
             WHERE m.fecha >= ? AND m.fecha <= ?`;
    const params: any[] = [startDate, endDate];
    if (trabajadorId) { q += ' AND m.trabajador_id = ?'; params.push(trabajadorId); }
    q += ' ORDER BY m.fecha ASC, m.hora ASC';

    const marcas = await db.all(q, ...params);
    const headers = ['Fecha', 'Hora', 'Empleado', 'Nombre', 'Tipo', 'Estado'];
    const rows = (marcas as any[]).map((m) => [m.fecha, m.hora, m.employee_no, m.nombre, m.tipo, m.estado]);
    const csv = toCSV(headers, rows);
    sendCSV(res, `marcaciones_${startDate}_a_${endDate}.csv`, csv);
  } catch (error: any) {
    res.status(500).json({ success: false, message: `Error exportando: ${error.message}` });
  }
};

router.get('/reportes/horas.csv', exportHorasCSV);
router.get('/marcaciones.csv', exportMarcacionesCSV);

export default router;
