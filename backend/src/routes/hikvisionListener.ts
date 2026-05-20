import { Router, Request, Response, RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Parser } from 'xml2js';
import { getDb } from '../db/database';
import { classifyScan, Schedule, AttendanceLog } from '../services/rulesEngine';
import { EventEmitter } from 'events';

const router = Router();

// Canal de eventos en tiempo real para el Dashboard (Server-Sent Events)
export const liveEvents = new EventEmitter();

// Configuración de almacenamiento de fotos capturadas en tiempo real
const uploadDir = path.join(__dirname, '../../../public/uploads/scans');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Nombre de archivo único: scan_[timestamp]_[ramdom].jpg
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `scan-${uniqueSuffix}.jpg`);
  }
});

const upload = multer({ storage: storage });

// Parser de XML a Objeto de JavaScript
const xmlParser = new Parser({ explicitArray: false, mergeAttrs: true });

interface HikvisionEventData {
  employeeNoString: string;
  dateTime: string;
  cardNo?: string;
}

/**
 * Helper para extraer la metadata estructurada del request
 */
async function parseEventMetadata(req: Request): Promise<HikvisionEventData | null> {
  let rawMetadata = '';

  // 1. Caso A: La metadata viene como un archivo cargado (común en multipart)
  if (req.files && Array.isArray(req.files)) {
    const files = req.files as Express.Multer.File[];
    
    // Buscar cualquier archivo que contenga texto, xml o json en su nombre o mimetype
    const metadataFile = files.find(f => 
      f.fieldname.includes('event_log') || 
      f.fieldname.includes('info') || 
      f.fieldname.includes('xml') || 
      f.fieldname.includes('json') ||
      f.mimetype.includes('xml') ||
      f.mimetype.includes('json') ||
      f.mimetype.includes('text')
    );

    if (metadataFile) {
      rawMetadata = fs.readFileSync(metadataFile.path, 'utf8');
      // Eliminar el archivo temporal de metadata para no llenar el disco
      try { fs.unlinkSync(metadataFile.path); } catch (e) {}
    }
  }

  // 2. Caso B: La metadata viene como un campo de texto en req.body
  if (!rawMetadata && req.body) {
    rawMetadata = req.body.event_log || req.body.AccessControllerEvent || req.body.info || '';
  }

  // 3. Caso C: Es una petición directa JSON sin multipart
  if (!rawMetadata && req.headers['content-type']?.includes('application/json') && req.body) {
    const event = req.body.AccessControllerEvent || req.body;
    if (event.employeeNoString) {
      return {
        employeeNoString: String(event.employeeNoString),
        dateTime: event.time || event.dateTime || new Date().toISOString(),
        cardNo: event.cardNo
      };
    }
  }

  if (!rawMetadata) {
    // Si no encontramos metadata en archivos ni body, intentamos revisar si se envió XML crudo en el body
    if (typeof req.body === 'string' && req.body.includes('<')) {
      rawMetadata = req.body;
    } else {
      return null;
    }
  }

  // Detectar e interpretar formato (XML o JSON)
  rawMetadata = rawMetadata.trim();
  if (rawMetadata.startsWith('<')) {
    try {
      const parsedXml = await xmlParser.parseStringPromise(rawMetadata);
      const root = parsedXml.EventNotificationAlert || parsedXml;
      const acsEvent = root.AccessControllerEvent || root;
      
      if (acsEvent && acsEvent.employeeNoString) {
        return {
          employeeNoString: String(acsEvent.employeeNoString),
          dateTime: acsEvent.time || root.dateTime || acsEvent.dateTime || new Date().toISOString(),
          cardNo: acsEvent.cardNo
        };
      }
    } catch (err) {
      console.error('Error parseando XML de Hikvision:', err);
    }
  } else {
    try {
      const parsedJson = JSON.parse(rawMetadata);
      const root = parsedJson.EventNotificationAlert || parsedJson;
      const acsEvent = root.AccessControllerEvent || root;

      if (acsEvent && acsEvent.employeeNoString) {
        return {
          employeeNoString: String(acsEvent.employeeNoString),
          dateTime: acsEvent.time || root.dateTime || acsEvent.dateTime || new Date().toISOString(),
          cardNo: acsEvent.cardNo
        };
      }
    } catch (err) {
      console.error('Error parseando JSON de Hikvision:', err);
    }
  }

  return null;
}

/**
 * ENDPOINT PRINCIPAL: Recepción de eventos desde el Hikvision HK-DS-K1T320EFWX-B
 * POST /api/v1/hikvision/events
 */
const handleEvents: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  console.log(`[Hikvision] Recibida marcación - Content-Type: ${req.headers['content-type']}`);

  try {
    const eventData = await parseEventMetadata(req);
    
    if (!eventData) {
      console.warn('[Hikvision] Petición inválida o metadata no encontrada.');
      res.status(400).json({ status: 'error', message: 'No metadata found' });
      return;
    }

    const { employeeNoString, dateTime, cardNo } = eventData;
    console.log(`[Hikvision] Empleado ID: ${employeeNoString}, Fecha/Hora: ${dateTime}`);

    // Buscar si el dispositivo envió una foto capturada
    let fotoScanUrl = '';
    if (req.files && Array.isArray(req.files)) {
      const files = req.files as Express.Multer.File[];
      // Buscar la foto en las claves comunes
      const fotoFile = files.find(f => 
        f.fieldname.includes('facialCapture') || 
        f.fieldname.includes('faceImage') || 
        f.mimetype.includes('image/jpeg')
      );

      if (fotoFile) {
        // Guardamos la ruta relativa accesible públicamente por la web
        fotoScanUrl = `/uploads/scans/${fotoFile.filename}`;
        console.log(`[Hikvision] Imagen facial guardada en: ${fotoScanUrl}`);
      }
    }

    const db = await getDb();

    // 1. Buscar al trabajador en la base de datos local
    const trabajador = await db.get(
      'SELECT t.*, h.nombre as horario_nombre, h.hora_entrada, h.hora_salida, h.minutos_tolerancia, h.break_duracion FROM trabajadores t LEFT JOIN horarios h ON t.horario_id = h.id WHERE t.employee_no = ?',
      employeeNoString
    );

    if (!trabajador) {
      console.warn(`[Hikvision] Empleado con ID "${employeeNoString}" no está registrado en la base de datos.`);
      res.status(404).json({ status: 'error', message: `Worker ${employeeNoString} not found in DB` });
      return;
    }

    // 2. Extraer fecha y hora locales del evento de Hikvision (formato "YYYY-MM-DD" e "HH:MM:SS")
    // Hikvision envía dateTime en formato ISO-8601 (ej. "2026-05-20T08:05:22-05:00")
    const dateObj = new Date(dateTime);
    const fecha = dateTime.substring(0, 10); // "2026-05-20"
    
    // Extraer hora local (HH:MM:SS) teniendo en cuenta zona horaria o tomando la porción de texto
    // La porción de texto del ISO-8601 es la más segura: "08:05:22"
    let hora = "08:00:00";
    const timeMatch = dateTime.match(/T(\d{2}:\d{2}:\d{2})/);
    if (timeMatch) {
      hora = timeMatch[1];
    } else {
      hora = dateObj.toTimeString().split(' ')[0];
    }

    // 3. Obtener el horario asignado (o uno por defecto si no tiene)
    const schedule: Schedule = {
      id: trabajador.horario_id || 0,
      nombre: trabajador.horario_nombre || 'Sin Horario',
      hora_entrada: trabajador.hora_entrada || '09:00',
      hora_salida: trabajador.hora_salida || '18:00',
      minutos_tolerancia: trabajador.minutos_tolerancia !== undefined ? trabajador.minutos_tolerancia : 15,
      break_duracion: trabajador.break_duracion !== undefined ? trabajador.break_duracion : 60
    };

    // 4. Obtener marcaciones que ya tenga registradas en este día
    const existingLogsToday: AttendanceLog[] = await db.all(
      'SELECT id, trabajador_id, fecha, hora, tipo, estado FROM marcaciones WHERE trabajador_id = ? AND fecha = ? ORDER BY id ASC',
      trabajador.id,
      fecha
    );

    // 5. Clasificar la marcación
    const { tipo, estado } = classifyScan(hora, existingLogsToday, schedule);
    console.log(`[Rules Engine] Clasificación: ${tipo} (${estado})`);

    // 6. Registrar en Base de Datos
    const insertResult = await db.run(
      `INSERT INTO marcaciones (trabajador_id, fecha, hora, tipo, estado, foto_scan_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      trabajador.id,
      fecha,
      hora,
      tipo,
      estado,
      fotoScanUrl || null
    );

    const logRecord = {
      id: insertResult.lastID,
      trabajador_id: trabajador.id,
      nombre_trabajador: trabajador.nombre,
      employee_no: trabajador.employee_no,
      fecha,
      hora,
      tipo,
      estado,
      foto_scan_url: fotoScanUrl || trabajador.foto_url
    };

    // 7. Notificar inmediatamente al Dashboard por Server-Sent Events (SSE)
    liveEvents.emit('new-scan', logRecord);

    // 8. Responder exitosamente al Hikvision
    // Algunos terminales requieren una estructura XML de respuesta específica. Respondemos 200 OK estructurado.
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      status: 'success',
      message: 'Event logged successfully',
      event: {
        id: logRecord.id,
        worker: logRecord.nombre_trabajador,
        type: logRecord.tipo,
        status: logRecord.estado
      }
    });

  } catch (error) {
    console.error('[Hikvision Listener Error]:', error);
    res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
};

// Configurar multer para aceptar campos de archivos dinámicos de Hikvision
// (usualmente envían event_log y facialCapture)
router.post('/events', upload.any(), handleEvents);

export default router;
