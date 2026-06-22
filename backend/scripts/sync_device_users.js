/**
 * Sincroniza los usuarios enrolados en el terminal Hikvision con la base de
 * datos local de la app, para que el dashboard muestre exactamente la misma
 * gente que el dispositivo (con su foto de rostro).
 *
 * Uso:
 *   node scripts/sync_device_users.js [IP] [usuario] [password]
 *   (o definiendo DEVICE_IP / DEVICE_USER / DEVICE_PASS en el entorno)
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const DEVICE_IP = process.argv[2] || process.env.DEVICE_IP || '192.168.0.16';
const USER = process.argv[3] || process.env.DEVICE_USER || 'admin';
const PASS = process.argv[4] || process.env.DEVICE_PASS;

if (!PASS) {
  console.error('Falta la clave del dispositivo: pásala como 3er argumento o en DEVICE_PASS.');
  process.exit(1);
}

const DB_PATH = path.join(__dirname, '../data/asistencia.db');
const FACES_DIR = path.join(__dirname, '../../public/uploads/faces');

if (!fs.existsSync(FACES_DIR)) fs.mkdirSync(FACES_DIR, { recursive: true });

/** Ejecuta curl con autenticación digest y devuelve stdout (Buffer o string). */
function curl(args, binary = false) {
  const base = ['-s', '-m', '20', '--digest', '-u', `${USER}:${PASS}`];
  return execFileSync('curl', base.concat(args), {
    maxBuffer: 50 * 1024 * 1024,
    encoding: binary ? 'buffer' : 'utf8',
  });
}

/** Trae todos los usuarios del dispositivo paginando la búsqueda ISAPI. */
function fetchAllUsers() {
  const all = [];
  let position = 0;
  const pageSize = 30;
  while (true) {
    const body = JSON.stringify({
      UserInfoSearchCond: {
        searchID: '1',
        maxResults: pageSize,
        searchResultPosition: position,
      },
    });
    const url = `http://${DEVICE_IP}/ISAPI/AccessControl/UserInfo/Search?format=json`;
    const raw = curl(['-X', 'POST', '-H', 'Content-Type: application/json', '--data', body, url]);
    const json = JSON.parse(raw);
    const search = json.UserInfoSearch || {};
    const list = search.UserInfo || [];
    all.push(...list);
    const total = search.totalMatches || all.length;
    position += list.length;
    if (list.length === 0 || all.length >= total) break;
  }
  return all;
}

/** Descarga la foto de rostro de un usuario; devuelve la URL pública o null. */
function downloadFace(user) {
  if (!user.faceURL) return null;
  // El faceURL trae un sufijo "@WEB..." que hay que recortar para la descarga.
  let url = user.faceURL.split('@')[0];
  try {
    const buf = curl([url], true);
    if (!buf || buf.length < 1000) return null; // foto inválida/placeholder
    const fileName = `emp_${user.employeeNo}.jpg`;
    fs.writeFileSync(path.join(FACES_DIR, fileName), buf);
    return `/uploads/faces/${fileName}`;
  } catch (e) {
    console.warn(`   ! No se pudo bajar la foto de ${user.employeeNo}: ${e.message}`);
    return null;
  }
}

function run() {
  return new Promise((resolve, reject) => {
    console.log(`-> Conectando al dispositivo ${DEVICE_IP} ...`);
    const users = fetchAllUsers();
    console.log(`-> ${users.length} usuarios encontrados en el terminal.`);

    const db = new sqlite3.Database(DB_PATH);
    const get = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r))));
    const all = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
    const runSql = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, function (e) { e ? rej(e) : res(this); }));

    (async () => {
      // Asegurar un horario por defecto
      let horario = await get('SELECT id FROM horarios ORDER BY id ASC LIMIT 1');
      if (!horario) {
        const r = await runSql(
          `INSERT INTO horarios (nombre, hora_entrada, hora_salida, minutos_tolerancia, break_duracion)
           VALUES ('Administrativo Diurno', '08:00', '17:00', 15, 60)`
        );
        horario = { id: r.lastID };
      }
      const horarioId = horario.id;

      const deviceNos = new Set();
      let inserted = 0, updated = 0, photos = 0;

      for (const u of users) {
        const employeeNo = String(u.employeeNo);
        const nombre = (u.name || `Empleado ${employeeNo}`).trim();
        deviceNos.add(employeeNo);

        const fotoUrl = downloadFace(u);
        if (fotoUrl) photos++;

        const existing = await get('SELECT id, foto_url FROM trabajadores WHERE employee_no = ?', [employeeNo]);
        if (existing) {
          await runSql(
            `UPDATE trabajadores SET nombre = ?, foto_url = COALESCE(?, foto_url), horario_id = COALESCE(horario_id, ?) WHERE id = ?`,
            [nombre, fotoUrl, horarioId, existing.id]
          );
          updated++;
        } else {
          await runSql(
            `INSERT INTO trabajadores (nombre, employee_no, foto_url, horario_id) VALUES (?, ?, ?, ?)`,
            [nombre, employeeNo, fotoUrl, horarioId]
          );
          inserted++;
        }
      }

      // Eliminar trabajadores que ya no existen en el dispositivo (y su historial de prueba)
      const localWorkers = await all('SELECT id, employee_no, nombre FROM trabajadores');
      let removed = 0;
      for (const w of localWorkers) {
        if (!deviceNos.has(String(w.employee_no))) {
          await runSql('DELETE FROM trabajadores WHERE id = ?', [w.id]); // CASCADE borra sus marcaciones
          console.log(`   - Eliminado trabajador huérfano: ${w.nombre} (#${w.employee_no})`);
          removed++;
        }
      }

      // Limpiar marcaciones de prueba sembradas (demo)
      const delMock = await runSql("DELETE FROM marcaciones WHERE foto_scan_url IN ('mock')");

      console.log('');
      console.log('==================== RESUMEN ====================');
      console.log(`  Insertados:        ${inserted}`);
      console.log(`  Actualizados:      ${updated}`);
      console.log(`  Fotos descargadas: ${photos}`);
      console.log(`  Huérfanos borrados: ${removed}`);
      console.log(`  Marcaciones demo limpiadas: ${delMock.changes}`);
      console.log('=================================================');

      db.close();
      resolve();
    })().catch((e) => { db.close(); reject(e); });
  });
}

run().then(() => process.exit(0)).catch((e) => { console.error('ERROR:', e); process.exit(1); });
