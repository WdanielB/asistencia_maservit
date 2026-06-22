# Backend: Express + TypeScript + SQLite (sqlite3 nativo)
# Node 22 para alinear con el entorno de desarrollo y la toolchain moderna
# (typescript 6, @types/node 25, express 5, sqlite3 6).
FROM node:22-bookworm-slim

# Zona horaria de Perú: el cálculo de horas nocturnas/extra usa la hora local del servidor.
ENV TZ=America/Lima
ENV NODE_ENV=production

# Dependencias de compilación para el módulo nativo sqlite3 + tzdata + curl (healthcheck/sync)
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ tzdata curl ca-certificates \
 && ln -sf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Instalar dependencias de forma reproducible desde el lockfile (incluye dev para compilar TS)
COPY package*.json ./
RUN npm ci

# Compilar TypeScript y luego quitar las dependencias de desarrollo
COPY . ./
RUN npm run build \
 && npm prune --omit=dev

# Carpetas persistibles (la BD y las fotos van por volumen en docker-compose)
RUN mkdir -p /app/public/uploads/scans /app/public/uploads/faces /app/backend/data

ENV PORT=5000
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:5000/health || exit 1

CMD ["node", "dist/server.js"]
