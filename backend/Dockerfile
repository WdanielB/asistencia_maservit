# Backend: Express + TypeScript + SQLite (sqlite3 nativo)
FROM node:20-bookworm-slim

# Zona horaria de Perú: el cálculo de horas nocturnas/extra usa la hora local del servidor.
ENV TZ=America/Lima

# Dependencias de compilación para el módulo nativo sqlite3 + tzdata + curl (healthcheck/sync)
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ tzdata curl ca-certificates \
 && ln -sf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

COPY package*.json ./
RUN npm install

COPY . ./
RUN npm run build

# Carpetas persistibles (la BD y las fotos van por volumen en docker-compose)
RUN mkdir -p /app/public/uploads/scans /app/public/uploads/faces /app/backend/data

ENV PORT=5000
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:5000/health || exit 1

CMD ["node", "dist/server.js"]
