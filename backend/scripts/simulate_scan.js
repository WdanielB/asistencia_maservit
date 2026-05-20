/**
 * SCRIPT SIMULADOR DE ESCANEO FACIAL HIKVISION
 * 
 * Este script emula de manera idéntica la petición POST multipart/form-data que
 * envía el terminal Hikvision HK-DS-K1T320EFWX-B en red local al detectar un rostro.
 * 
 * Permite testear el backend, el motor de reglas de horarios y el dashboard en tiempo real
 * sin necesidad de tener el dispositivo físico conectado ni encendido.
 * 
 * Uso:
 *   node simulate_scan.js [employeeNo] [timeOverride]
 * 
 * Ejemplos:
 *   node simulate_scan.js 1           -> Simula marcación de Daniel Rossi (Empleado 1) ahora.
 *   node simulate_scan.js 2 08:05:00  -> Entrada puntual de María (Empleado 2) a las 08:05.
 *   node simulate_scan.js 2 08:25:00  -> Entrada tarde de María a las 08:25.
 *   node simulate_scan.js 1 12:30:00  -> Salida a break de Daniel a las 12:30.
 *   node simulate_scan.js 1 13:30:00  -> Regreso de break de Daniel a las 13:30.
 *   node simulate_scan.js 1 17:05:00  -> Salida definitiva de Daniel a las 17:05.
 */

const employeeNo = process.argv[2] || '1';
const timeOverride = process.argv[3]; // "HH:MM:SS"

// Generar fecha y hora para el XML
const now = new Date();
const dateStr = now.toISOString().substring(0, 10); // "YYYY-MM-DD"
let isoString = now.toISOString(); // Formato estándar con zona horaria simulada

if (timeOverride) {
  // Ajustar la fecha actual con la hora provista
  const [h, m, s] = timeOverride.split(':');
  const customDate = new Date();
  customDate.setHours(parseInt(h), parseInt(m), parseInt(s || '0'));
  isoString = `${dateStr}T${timeOverride}-05:00`;
  console.log(`[Simulador] Usando hora personalizada: ${timeOverride} (ISO: ${isoString})`);
} else {
  console.log(`[Simulador] Usando hora actual: ${now.toLocaleTimeString()}`);
}

// 1. Crear el XML de metadata exacto que envía Hikvision
const xmlMetadata = `
<EventNotificationAlert version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <ipAddress>192.168.1.120</ipAddress>
  <portNo>80</portNo>
  <protocol>HTTP</protocol>
  <macAddress>a0:b1:c2:d3:e4:f5</macAddress>
  <channelID>1</channelID>
  <dateTime>${isoString}</dateTime>
  <activePostCount>1</activePostCount>
  <eventType>AccessControlEvent</eventType>
  <eventDescription>facial recognition succeeded</eventDescription>
  <AccessControllerEvent>
    <majorNo>5</majorNo>
    <minorNo>75</minorNo>
    <time>${isoString}</time>
    <employeeNoString>${employeeNo}</employeeNoString>
    <cardNo>901234</cardNo>
    <userType>normal</userType>
    <currentVerifyMode>face</currentVerifyMode>
    <attendanceStatus>normal</attendanceStatus>
  </AccessControllerEvent>
</EventNotificationAlert>
`.trim();

// 2. Crear una imagen JPEG simulada de 1x1 pixel negro en Base64
const dummyJpgBase64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
const dummyJpgBuffer = Buffer.from(dummyJpgBase64, 'base64');

async function sendMockScan() {
  const url = 'http://localhost:5000/api/v1/hikvision/events';

  try {
    // Usar la API nativa de FormData de Node 18+
    const formData = new FormData();

    // Agregar archivo de metadata XML
    const xmlBlob = new Blob([xmlMetadata], { type: 'application/xml' });
    formData.append('event_log', xmlBlob, 'event_log.xml');

    // Agregar archivo de imagen facial capturada
    const imgBlob = new Blob([dummyJpgBuffer], { type: 'image/jpeg' });
    formData.append('facialCapture', imgBlob, 'facialCapture.jpg');

    console.log(`-> Enviando marcación simulada para trabajador ID "${employeeNo}"...`);

    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    console.log('\n=====================================================');
    console.log(`Respuesta del servidor (${response.status} ${response.statusText}):`);
    console.log(JSON.stringify(result, null, 2));
    console.log('=====================================================\n');

    if (response.ok) {
      console.log('¡Escaneo simulado exitosamente! Revisá tu consola del servidor y el dashboard web.');
    } else {
      console.error('El servidor rechazó el escaneo simulado.');
    }

  } catch (error) {
    console.error('Error de conexión con el servidor. ¿Está el backend encendido en el puerto 5000?', error.message);
  }
}

sendMockScan();
