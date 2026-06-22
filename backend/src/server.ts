import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { getDb } from './db/database';
import hikvisionRouter from './routes/hikvisionListener';
import adminRouter from './routes/adminRoutes';
import { requireAuth, loginHandler } from './auth';

// Trigger database reload & exact-hour historical mock data seeding
const app = express();
const PORT = process.env.PORT || 5000;

// Habilitar CORS para permitir solicitudes del dashboard web (React/Vite)
app.use(cors({
  origin: '*', // Permitir todas las conexiones para facilitar integraciones
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middlewares para parsear cuerpos de peticiones estándar
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir la carpeta de fotos cargadas de forma pública
const publicDir = path.join(__dirname, '../../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
app.use('/uploads', express.static(path.join(publicDir, 'uploads')));

// Login (público): debe ir ANTES del guard para no exigir token a sí mismo.
app.post('/api/v1/admin/login', loginHandler);

// Rutas de la Aplicación
// El terminal Hikvision no puede enviar token: su endpoint queda abierto en la LAN.
app.use('/api/v1/hikvision', hikvisionRouter);
// El panel administrativo exige token válido (cabecera Bearer o ?token=).
app.use('/api/v1/admin', requireAuth, adminRouter);

// Ruta básica de verificación de salud
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Servidor de control de asistencia activo.' });
});

// Inicializar Servidor y Base de Datos
async function startServer() {
  try {
    console.log('-> Conectando con la base de datos SQLite...');
    await getDb();
    
    app.listen(PORT, () => {
      console.log(`=====================================================`);
      console.log(`¡SERVIDOR DE ASISTENCIA INICIADO EXITOSAMENTE! 🚀`);
      console.log(`Puerto de escucha: ${PORT}`);
      console.log(`Endpoint Hikvision: http://<ip-servidor>:${PORT}/api/v1/hikvision/events`);
      console.log(`Endpoint Dashboard: http://<ip-servidor>:${PORT}/api/v1/admin`);
      console.log(`=====================================================`);
    });
  } catch (error) {
    console.error('CRÍTICO: No se pudo iniciar la base de datos o el servidor:', error);
    process.exit(1);
  }
}

startServer();
