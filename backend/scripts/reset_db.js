const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function reset() {
  const dbPath = path.join(__dirname, '../data/asistencia.db');
  console.log('-> Abriendo la base de datos para limpieza...');
  
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Habilitar claves foráneas para cascadas
  await db.run('PRAGMA foreign_keys = OFF');

  console.log('-> Vaciando tabla de marcaciones...');
  await db.run('DELETE FROM marcaciones');
  
  console.log('-> Vaciando tabla de trabajadores...');
  await db.run('DELETE FROM trabajadores');
  
  console.log('-> Vaciando tabla de horarios...');
  await db.run('DELETE FROM horarios');

  // Resetear autoincrementales
  await db.run("DELETE FROM sqlite_sequence WHERE name IN ('horarios', 'trabajadores', 'marcaciones')");

  await db.run('PRAGMA foreign_keys = ON');
  
  console.log('-> ¡Base de datos limpiada con éxito!');
  console.log('-> El servidor Express se encargará de realizar el re-seeding automático en su próximo inicio.');
  
  await db.close();
}

reset().catch(error => {
  console.error('Error al resetear la base de datos:', error);
});
