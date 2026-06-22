# MASERVIT ASISTENCIA 🕒👥

Un sistema de control de asistencia de alto rendimiento diseñado a medida para **MASERVIT**, que integra de manera directa y eficiente el terminal de reconocimiento facial **Hikvision HK-DS-K1T320EFWX-B** con un backend de Express + SQLite y un dashboard web interactivo moderno en React + Vite.

El sistema utiliza el patrón de comunicación **Push (HTTP Listening Host)** nativo del dispositivo Hikvision, procesando eventos en caliente e inyectando las marcaciones al vuelo mediante **Server-Sent Events (SSE)** en la interfaz web de administración.

---

## 🚀 Características Clave

* **Dashboard en Tiempo Real**: Feed de asistencia en caliente con foto capturada por la cámara, nombre del trabajador, hora exacta y estado.
* **Integración Nativa Hikvision**: Receptor HTTP que procesa peticiones `multipart/form-data` con XML/JSON y JPGs enviados directo desde el terminal Hikvision HK-DS-K1T320EFWX-B.
* **Motor de Reglas Inteligente**: El servidor deduce de forma autónoma el tipo de marca (`ENTRADA`, `SALIDA`, `BREAK_IN`, `BREAK_OUT`) y el estado (`PUNTUAL`, `TARDANZA`, `CORRECTO`) basándose únicamente en los escaneos y los límites configurados.
* **Gestión de Trabajadores (CRUD)**: Creación y edición de perfiles, con asignación flexible de turnos de trabajo.
* **Configurador de Horarios**: Definición de horas de entrada, salida, tolerancia en minutos y duración de breaks para el almuerzo.
* **Historial & Reportes Detallados**: Listado de marcas por fecha, trabajador y estado, con soporte para inyecciones manuales por justificación administrativa.
* **Diseño Flat Dark Premium**: Estética moderna con colores armoniosos, bordes limpios, fuentes profesionales e íconos vectoriales SVG limpios de emojis.

---

## 📁 Estructura del Monorepo

```directory
MASERVIT ASISTENCIA/
├── backend/                  # Servidor Express + TypeScript + SQLite
│   ├── src/
│   │   ├── db/database.ts    # Conexión SQLite y migraciones con better-sqlite3
│   │   ├── routes/
│   │   │   ├── adminRoutes.ts      # API REST de administración y feed de SSE
│   │   │   └── hikvisionListener.ts # Endpoint receptor de la cámara Hikvision
│   │   ├── services/
│   │   │   └── rulesEngine.ts      # Motor de reglas horarias inteligente
│   │   └── server.ts         # Entrada principal del servidor Express
│   ├── scripts/
│   │   ├── simulate_scan.js  # Script de simulación para pruebas del Hikvision
│   │   └── reset_db.js       # Script seguro de reinicio de base de datos
│   └── data/
│       └── asistencia.db     # Base de datos local SQLite (autogenerada)
├── frontend/                 # Aplicación Cliente React + Vite + Vanilla CSS
│   ├── src/
│   │   ├── components/
│   │   │   ├── DashboardHome.tsx   # Panel de control room en tiempo real
│   │   │   ├── WorkersPanel.tsx    # Gestión estética de trabajadores
│   │   │   ├── SchedulesPanel.tsx  # Configurador visual de turnos
│   │   │   └── ReportsPanel.tsx    # Buscador de historial y reportes
│   │   ├── App.tsx           # Layout principal y navegación lateral SVG
│   │   └── index.css         # Estilos globales y tokens del tema Flat Dark
│   └── index.html            # Punto de entrada HTML5
└── public/
    └── uploads/
        └── scans/            # Rostros capturados en tiempo real por el terminal
```

---

## 🔌 Conexión Directa con el Terminal Hikvision

Para que la comunicación funcione de manera rápida y sin intermediarios (iVMS, etc.):
1. **IP Estática**: Asigná una IP fija al servidor en la red local (ej. `192.168.1.100`).
2. **Configuración de Red**: Entrá a la interfaz web de tu terminal Hikvision (ej. `http://192.168.1.201`).
3. **HTTP Listening Host (Alarm Host)**:
   - Activá la subida de alarmas/eventos por HTTP.
   - Seteá la dirección de destino: `http://<IP-DE-TU-SERVIDOR>:5000/api/v1/hikvision/events`.
   - Elegí el formato de evento en el terminal (XML o JSON). El backend procesa ambos automáticamente.
4. **Respuestas ACK conformes**: Al escanear una cara, el Hikvision envía un payload `POST multipart` al listener. El backend procesa la imagen, evalúa las reglas y devuelve un `200 OK` plano. Esto hace que el terminal entienda que el evento fue guardado con éxito, limpiando su cola interna y evitando repeticiones.

---

## 🛠️ Instalación y Configuración Local

### Prerrequisitos
* **Node.js** (v16 o superior)
* **npm** o **yarn**

### 1. Clonar el repositorio
```bash
git clone https://github.com/WdanielB/asistencia_maservit.git
cd asistencia_maservit
```

### 2. Configurar e iniciar el Backend
Entrá al directorio de backend, instalá las dependencias y levantá el servidor:
```bash
cd backend
npm install
npm run dev
```
El backend se iniciará en `http://localhost:5000`. Inicializará automáticamente la base de datos SQLite y creará tablas con datos semilla para pruebas inmediatas si la base de datos está vacía.

### 3. Configurar e iniciar el Frontend
Abrí otra terminal en el directorio raíz de la aplicación, instalá dependencias e iniciá el servidor Vite:
```bash
cd frontend
npm install
npm run dev
```
El cliente React se iniciará en `http://localhost:5173`. Abrilo en tu navegador favorito.

---

## 🧪 Pruebas y Simulación (Sin Cámara Física)

Para probar el motor de reglas y la reactividad SSE del dashboard sin necesidad de conectar el dispositivo físico inicialmente, proveemos un **script de simulación**:

1. Asegurate de tener corriendo tanto el backend como el frontend.
2. Desde la carpeta `backend`, ejecutá el simulador de marcaciones pasando el ID del trabajador y (opcionalmente) una hora específica:

```bash
# Simular marcación de entrada para Daniel Rossi (ID 1) en la hora actual
node scripts/simulate_scan.js 1

# Simular entrada tarde a las 08:25 para María Giménez (ID 2)
node scripts/simulate_scan.js 2 08:25:00

# Simular marcación de almuerzo (salida a break) para Ignacio Torres (ID 3)
node scripts/simulate_scan.js 3 12:45:00
```
Verás de forma instantánea cómo el dashboard React inyecta la marcación en caliente con la foto simulada, actualiza las tarjetas de estadísticas globales y lo guarda de forma inmutable en el historial.

---

## 🔄 Reiniciar Base de Datos
Si deseás limpiar todas las marcas del historial de prueba y volver al estado inicial del sembrado:
```bash
cd backend
node scripts/reset_db.js
```
Esto limpiará de manera segura las tablas de SQLite (esquivando bloqueos de base de datos) y re-sembrará las tablas limpias para un reinicio fresco.

---

## Despliegue con Docker

El sistema se empaqueta en dos contenedores orquestados con `docker-compose`:

- **backend**: Express + SQLite (puerto `5000`), zona horaria fijada en `America/Lima` (necesaria para el cálculo de horas nocturnas y extra).
- **frontend**: build estático de Vite servido por **nginx**, que además hace de *reverse proxy* hacia el backend (`/api`, `/uploads`, `/health`). El frontend usa rutas relativas, por lo que funciona detrás del proxy sin configurar IPs.

### Levantar

```bash
docker compose up -d --build
```

- Panel web: `http://<ip-servidor>:8080`
- El terminal Hikvision debe apuntar sus eventos a `http://<ip-servidor>:5000/api/v1/hikvision/events` (el backend se publica en el puerto `5000` de la LAN).

### Persistencia

Dos volúmenes nombrados conservan los datos entre reinicios:

- `backend-data` → base SQLite (`/app/backend/data`)
- `uploads` → rostros enrolados y capturas (`/app/public/uploads`)

### Operación

```bash
# Sincronizar usuarios del terminal hacia la app (dentro del contenedor)
docker compose exec backend node scripts/sync_device_users.js

# Ver logs
docker compose logs -f backend
```

> Desarrollo local (sin Docker): el frontend usa rutas relativas y Vite las redirige al backend vía proxy (ver `frontend/vite.config.ts`). Si el backend no está en `localhost:5000`, definí `VITE_BACKEND` antes de `npm run dev`.
