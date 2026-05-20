import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

let db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

export async function getDb() {
  if (db) return db;
  
  const dbDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  const dbPath = path.join(dbDir, 'asistencia.db');
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  
  // Habilitar claves foráneas en SQLite
  await db.run('PRAGMA foreign_keys = ON');
  
  await initSchema();
  
  return db;
}

async function initSchema() {
  if (!db) return;

  // 1. Crear tabla de Horarios
  await db.exec(`
    CREATE TABLE IF NOT EXISTS horarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      hora_entrada TEXT NOT NULL, -- Formato HH:MM
      hora_salida TEXT NOT NULL,  -- Formato HH:MM
      minutos_tolerancia INTEGER DEFAULT 0,
      break_duracion INTEGER DEFAULT 60, -- En minutos
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Crear tabla de Trabajadores
  await db.exec(`
    CREATE TABLE IF NOT EXISTS trabajadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      employee_no TEXT UNIQUE NOT NULL, -- Coincide con 'employeeNoString' de Hikvision
      card_no TEXT,                     -- Número de tarjeta opcional
      foto_url TEXT,                    -- URL o path físico de la foto de perfil
      horario_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (horario_id) REFERENCES horarios (id) ON DELETE SET NULL
    )
  `);

  // 3. Crear tabla de Marcaciones
  await db.exec(`
    CREATE TABLE IF NOT EXISTS marcaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trabajador_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,              -- YYYY-MM-DD
      hora TEXT NOT NULL,               -- HH:MM:SS
      tipo TEXT NOT NULL,               -- ENTRADA, BREAK_IN, BREAK_OUT, SALIDA
      estado TEXT NOT NULL,             -- PUNTUAL, TARDANZA, CORRECTO
      foto_scan_url TEXT,               -- Captura facial tomada por la cámara en tiempo real
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trabajador_id) REFERENCES trabajadores (id) ON DELETE CASCADE
    )
  `);

  // Insertar datos semilla para pruebas si las tablas están vacías
  const row = await db.get('SELECT COUNT(*) as count FROM horarios');
  const countHorarios = row ? (row as any).count : 0;
  
  if (countHorarios === 0) {
    console.log('-> Inicializando base de datos vacía con datos semilla...');
    
    // Horario de oficina estándar
    const defaultHorario = await db.run(`
      INSERT INTO horarios (nombre, hora_entrada, hora_salida, minutos_tolerancia, break_duracion)
      VALUES ('Administrativo Diurno', '08:00', '17:00', 15, 60)
    `);
    
    const scheduleId = defaultHorario.lastID;
    
    // Empleados iniciales
    await db.run(`
      INSERT INTO trabajadores (nombre, employee_no, card_no, horario_id)
      VALUES ('Daniel Rossi', '1', '901234', ?)
    `, scheduleId);
    
    await db.run(`
      INSERT INTO trabajadores (nombre, employee_no, card_no, horario_id)
      VALUES ('María Giménez', '2', '567890', ?)
    `, scheduleId);
    
    await db.run(`
      INSERT INTO trabajadores (nombre, employee_no, card_no, horario_id)
      VALUES ('Ignacio Delgado', '3', '345678', ?)
    `, scheduleId);

    console.log('-> Datos semilla inicializados exitosamente.');
  }

  // 4. Insertar marcaciones de prueba para el historial con horas exactas
  const rowMarc = await db.get('SELECT COUNT(*) as count FROM marcaciones');
  const countMarcaciones = rowMarc ? (rowMarc as any).count : 0;

  if (countMarcaciones === 0) {
    console.log('-> Inicializando historial de marcaciones de prueba con horas exactas...');

    // Obtener los IDs de los trabajadores
    const daniel = await db.get("SELECT id FROM trabajadores WHERE employee_no = '1'");
    const maria = await db.get("SELECT id FROM trabajadores WHERE employee_no = '2'");
    const ignacio = await db.get("SELECT id FROM trabajadores WHERE employee_no = '3'");

    if (daniel && maria && ignacio) {
      const mockHistory = [
        // --- 2026-05-13 (Miércoles) ---
        { tid: daniel.id, fecha: '2026-05-13', hora: '07:52:10', tipo: 'ENTRADA', estado: 'PUNTUAL' },
        { tid: daniel.id, fecha: '2026-05-13', hora: '12:01:45', tipo: 'BREAK_IN', estado: 'CORRECTO' },
        { tid: daniel.id, fecha: '2026-05-13', hora: '13:00:12', tipo: 'BREAK_OUT', estado: 'CORRECTO' },
        { tid: daniel.id, fecha: '2026-05-13', hora: '17:03:55', tipo: 'SALIDA', estado: 'CORRECTO' },

        { tid: maria.id, fecha: '2026-05-13', hora: '08:04:30', tipo: 'ENTRADA', estado: 'PUNTUAL' },
        { tid: maria.id, fecha: '2026-05-13', hora: '12:15:20', tipo: 'BREAK_IN', estado: 'CORRECTO' },
        { tid: maria.id, fecha: '2026-05-13', hora: '13:14:40', tipo: 'BREAK_OUT', estado: 'CORRECTO' },
        { tid: maria.id, fecha: '2026-05-13', hora: '17:01:10', tipo: 'SALIDA', estado: 'CORRECTO' },

        { tid: ignacio.id, fecha: '2026-05-13', hora: '07:45:00', tipo: 'ENTRADA', estado: 'PUNTUAL' },
        { tid: ignacio.id, fecha: '2026-05-13', hora: '12:00:15', tipo: 'BREAK_IN', estado: 'CORRECTO' },
        { tid: ignacio.id, fecha: '2026-05-13', hora: '12:59:30', tipo: 'BREAK_OUT', estado: 'CORRECTO' },
        { tid: ignacio.id, fecha: '2026-05-13', hora: '17:00:05', tipo: 'SALIDA', estado: 'CORRECTO' },

        // --- 2026-05-14 (Jueves) ---
        { tid: daniel.id, fecha: '2026-05-14', hora: '07:54:12', tipo: 'ENTRADA', estado: 'PUNTUAL' },
        { tid: daniel.id, fecha: '2026-05-14', hora: '12:02:45', tipo: 'BREAK_IN', estado: 'CORRECTO' },
        { tid: daniel.id, fecha: '2026-05-14', hora: '13:01:12', tipo: 'BREAK_OUT', estado: 'CORRECTO' },
        { tid: daniel.id, fecha: '2026-05-14', hora: '17:05:30', tipo: 'SALIDA', estado: 'CORRECTO' },

        { tid: maria.id, fecha: '2026-05-14', hora: '08:08:15', tipo: 'ENTRADA', estado: 'PUNTUAL' },
        { tid: maria.id, fecha: '2026-05-14', hora: '12:12:00', tipo: 'BREAK_IN', estado: 'CORRECTO' },
        { tid: maria.id, fecha: '2026-05-14', hora: '13:10:55', tipo: 'BREAK_OUT', estado: 'CORRECTO' },
        { tid: maria.id, fecha: '2026-05-14', hora: '17:00:40', tipo: 'SALIDA', estado: 'CORRECTO' },

        { tid: ignacio.id, fecha: '2026-05-14', hora: '07:48:22', tipo: 'ENTRADA', estado: 'PUNTUAL' },
        { tid: ignacio.id, fecha: '2026-05-14', hora: '12:00:05', tipo: 'BREAK_IN', estado: 'CORRECTO' },
        { tid: ignacio.id, fecha: '2026-05-14', hora: '12:55:10', tipo: 'BREAK_OUT', estado: 'CORRECTO' },
        { tid: ignacio.id, fecha: '2026-05-14', hora: '17:02:15', tipo: 'SALIDA', estado: 'CORRECTO' },

        // --- 2026-05-15 (Viernes) ---
        { tid: daniel.id, fecha: '2026-05-15', hora: '07:58:30', tipo: 'ENTRADA', estado: 'PUNTUAL' },
        { tid: daniel.id, fecha: '2026-05-15', hora: '12:05:10', tipo: 'BREAK_IN', estado: 'CORRECTO' },
        { tid: daniel.id, fecha: '2026-05-15', hora: '13:03:45', tipo: 'BREAK_OUT', estado: 'CORRECTO' },
        { tid: daniel.id, fecha: '2026-05-15', hora: '17:01:20', tipo: 'SALIDA', estado: 'CORRECTO' },

        { tid: maria.id, fecha: '2026-05-15', hora: '08:22:15', tipo: 'ENTRADA', estado: 'TARDANZA' },
        { tid: maria.id, fecha: '2026-05-15', hora: '12:30:10', tipo: 'BREAK_IN', estado: 'CORRECTO' },
        { tid: maria.id, fecha: '2026-05-15', hora: '13:28:40', tipo: 'BREAK_OUT', estado: 'CORRECTO' },
        { tid: maria.id, fecha: '2026-05-15', hora: '17:15:00', tipo: 'SALIDA', estado: 'CORRECTO' },

        { tid: ignacio.id, fecha: '2026-05-15', hora: '07:55:12', tipo: 'ENTRADA', estado: 'PUNTUAL' },
        { tid: ignacio.id, fecha: '2026-05-15', hora: '12:02:30', tipo: 'BREAK_IN', estado: 'CORRECTO' },
        { tid: ignacio.id, fecha: '2026-05-15', hora: '12:59:15', tipo: 'BREAK_OUT', estado: 'CORRECTO' },
        { tid: ignacio.id, fecha: '2026-05-15', hora: '17:05:40', tipo: 'SALIDA', estado: 'CORRECTO' },

        // --- 2026-05-18 (Lunes) ---
        { tid: daniel.id, fecha: '2026-05-18', hora: '08:12:44', tipo: 'ENTRADA', estado: 'PUNTUAL' },
        { tid: daniel.id, fecha: '2026-05-18', hora: '12:10:15', tipo: 'BREAK_IN', estado: 'CORRECTO' },
        { tid: daniel.id, fecha: '2026-05-18', hora: '13:08:50', tipo: 'BREAK_OUT', estado: 'CORRECTO' },
        { tid: daniel.id, fecha: '2026-05-18', hora: '17:04:10', tipo: 'SALIDA', estado: 'CORRECTO' },

        { tid: maria.id, fecha: '2026-05-18', hora: '08:01:05', tipo: 'ENTRADA', estado: 'PUNTUAL' },
        { tid: maria.id, fecha: '2026-05-18', hora: '12:05:45', tipo: 'BREAK_IN', estado: 'CORRECTO' },
        { tid: maria.id, fecha: '2026-05-18', hora: '13:04:22', tipo: 'BREAK_OUT', estado: 'CORRECTO' },
        { tid: maria.id, fecha: '2026-05-18', hora: '17:00:15', tipo: 'SALIDA', estado: 'CORRECTO' },

        { tid: ignacio.id, fecha: '2026-05-18', hora: '07:52:30', tipo: 'ENTRADA', estado: 'PUNTUAL' },
        { tid: ignacio.id, fecha: '2026-05-18', hora: '12:00:10', tipo: 'BREAK_IN', estado: 'CORRECTO' },
        { tid: ignacio.id, fecha: '2026-05-18', hora: '12:58:45', tipo: 'BREAK_OUT', estado: 'CORRECTO' },
        { tid: ignacio.id, fecha: '2026-05-18', hora: '17:02:30', tipo: 'SALIDA', estado: 'CORRECTO' },

        // --- 2026-05-19 (Martes) ---
        { tid: daniel.id, fecha: '2026-05-19', hora: '07:51:22', tipo: 'ENTRADA', estado: 'PUNTUAL' },
        { tid: daniel.id, fecha: '2026-05-19', hora: '12:00:55', tipo: 'BREAK_IN', estado: 'CORRECTO' },
        { tid: daniel.id, fecha: '2026-05-19', hora: '12:59:10', tipo: 'BREAK_OUT', estado: 'CORRECTO' },
        { tid: daniel.id, fecha: '2026-05-19', hora: '17:00:20', tipo: 'SALIDA', estado: 'CORRECTO' },

        { tid: maria.id, fecha: '2026-05-19', hora: '08:19:40', tipo: 'ENTRADA', estado: 'TARDANZA' },
        { tid: maria.id, fecha: '2026-05-19', hora: '12:20:15', tipo: 'BREAK_IN', estado: 'CORRECTO' },
        { tid: maria.id, fecha: '2026-05-19', hora: '13:18:50', tipo: 'BREAK_OUT', estado: 'CORRECTO' },
        { tid: maria.id, fecha: '2026-05-19', hora: '17:03:00', tipo: 'SALIDA', estado: 'CORRECTO' },

        { tid: ignacio.id, fecha: '2026-05-19', hora: '07:56:45', tipo: 'ENTRADA', estado: 'PUNTUAL' },
        { tid: ignacio.id, fecha: '2026-05-19', hora: '12:01:30', tipo: 'BREAK_IN', estado: 'CORRECTO' },
        { tid: ignacio.id, fecha: '2026-05-19', hora: '12:57:12', tipo: 'BREAK_OUT', estado: 'CORRECTO' },
        { tid: ignacio.id, fecha: '2026-05-19', hora: '17:00:10', tipo: 'SALIDA', estado: 'CORRECTO' }
      ];

      for (const mock of mockHistory) {
        await db.run(
          `INSERT INTO marcaciones (trabajador_id, fecha, hora, tipo, estado, foto_scan_url)
           VALUES (?, ?, ?, ?, ?, 'mock')`,
          mock.tid,
          mock.fecha,
          mock.hora,
          mock.tipo,
          mock.estado
        );
      }
      console.log('-> Historial de marcaciones semilla inicializado exitosamente.');
    }
  }
}
