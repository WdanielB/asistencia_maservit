/**
 * Cliente ISAPI para el terminal Hikvision (DS-K1T320EFX).
 * Implementa autenticación HTTP Digest sin dependencias externas, reutilizando
 * el nonce entre peticiones (incrementando nc) para no rehacer el handshake en
 * cada frame del stream de la cámara.
 */
import http from 'http';
import crypto from 'crypto';

export interface DeviceConfig {
  ip: string;
  user: string;
  pass: string;
}

interface DigestState {
  realm: string;
  nonce: string;
  qop: string;
  opaque?: string;
  nc: number;
}

const md5 = (s: string) => crypto.createHash('md5').update(s).digest('hex');

// Cache del estado digest por dispositivo (clave = ip)
const digestCache = new Map<string, DigestState>();

function parseAuthHeader(header: string): Partial<DigestState> {
  const out: any = {};
  const regex = /(\w+)=(?:"([^"]*)"|([^,]*))/g;
  let m;
  while ((m = regex.exec(header)) !== null) {
    out[m[1]] = m[2] !== undefined ? m[2] : m[3];
  }
  return { realm: out.realm, nonce: out.nonce, qop: out.qop, opaque: out.opaque };
}

function buildAuthHeader(cfg: DeviceConfig, method: string, uri: string, st: DigestState): string {
  const cnonce = crypto.randomBytes(8).toString('hex');
  const nc = String(st.nc).padStart(8, '0');
  const ha1 = md5(`${cfg.user}:${st.realm}:${cfg.pass}`);
  const ha2 = md5(`${method}:${uri}`);
  const response = md5(`${ha1}:${st.nonce}:${nc}:${cnonce}:${st.qop}:${ha2}`);
  let h = `Digest username="${cfg.user}", realm="${st.realm}", nonce="${st.nonce}", uri="${uri}", `;
  h += `qop=${st.qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
  if (st.opaque) h += `, opaque="${st.opaque}"`;
  return h;
}

interface DeviceResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

function rawRequest(
  cfg: DeviceConfig,
  method: string,
  uri: string,
  authHeader?: string,
  body?: Buffer | string,
  extraHeaders: Record<string, string> = {}
): Promise<DeviceResponse> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { ...extraHeaders };
    if (authHeader) headers['Authorization'] = authHeader;
    if (body) headers['Content-Length'] = Buffer.byteLength(body).toString();
    const req = http.request(
      { host: cfg.ip, port: 80, method, path: uri, headers, timeout: 15000 },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks) })
        );
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Device request timeout')));
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Realiza una petición autenticada al dispositivo, manejando el handshake digest
 * y reutilizando el nonce cacheado cuando es posible.
 */
export async function deviceRequest(
  cfg: DeviceConfig,
  method: string,
  uri: string,
  body?: Buffer | string,
  extraHeaders: Record<string, string> = {}
): Promise<DeviceResponse> {
  let st = digestCache.get(cfg.ip);

  // Intento con nonce cacheado
  if (st) {
    st.nc += 1;
    const auth = buildAuthHeader(cfg, method, uri, st);
    const r = await rawRequest(cfg, method, uri, auth, body, extraHeaders);
    if (r.status !== 401) return r;
    digestCache.delete(cfg.ip); // nonce expiró
  }

  // Handshake: pedir el challenge
  const challenge = await rawRequest(cfg, method, uri, undefined, body, extraHeaders);
  if (challenge.status !== 401) return challenge; // no requirió auth
  const wwwAuth = challenge.headers['www-authenticate'];
  if (!wwwAuth) throw new Error('El dispositivo no devolvió challenge de autenticación');
  const parsed = parseAuthHeader(String(wwwAuth));
  st = {
    realm: parsed.realm || '',
    nonce: parsed.nonce || '',
    qop: parsed.qop || 'auth',
    opaque: parsed.opaque,
    nc: 1,
  };
  digestCache.set(cfg.ip, st);
  const auth = buildAuthHeader(cfg, method, uri, st);
  return rawRequest(cfg, method, uri, auth, body, extraHeaders);
}

/** Captura una foto instantánea del canal de la cámara (JPEG). */
export async function getSnapshot(cfg: DeviceConfig): Promise<Buffer> {
  const r = await deviceRequest(cfg, 'GET', '/ISAPI/Streaming/channels/101/picture');
  if (r.status !== 200) throw new Error(`Snapshot falló: HTTP ${r.status}`);
  return r.body;
}

/** Crea (o actualiza) un usuario en el terminal vía ISAPI. */
export async function createDeviceUser(
  cfg: DeviceConfig,
  employeeNo: string,
  name: string
): Promise<{ ok: boolean; message: string }> {
  const payload = JSON.stringify({
    UserInfo: {
      employeeNo: String(employeeNo),
      name,
      userType: 'normal',
      Valid: {
        enable: true,
        beginTime: '2024-01-01T00:00:00',
        endTime: '2037-12-31T23:59:59',
        timeType: 'local',
      },
      doorRight: '1',
      RightPlan: [{ doorNo: 1, planTemplateNo: '1' }],
    },
  });
  const r = await deviceRequest(
    cfg,
    'POST',
    '/ISAPI/AccessControl/UserInfo/Record?format=json',
    payload,
    { 'Content-Type': 'application/json' }
  );
  let message = `HTTP ${r.status}`;
  try {
    const j = JSON.parse(r.body.toString());
    message = j.statusString || j.subStatusCode || message;
  } catch {}
  return { ok: r.status === 200, message };
}

/** Verifica conectividad básica leyendo deviceInfo. */
export async function pingDevice(cfg: DeviceConfig): Promise<boolean> {
  try {
    const r = await deviceRequest(cfg, 'GET', '/ISAPI/System/deviceInfo');
    return r.status === 200;
  } catch {
    return false;
  }
}

interface MultipartPart {
  name: string;
  filename?: string;
  contentType: string;
  data: Buffer | string;
}

/** Construye un cuerpo multipart/form-data. */
function buildMultipart(parts: MultipartPart[]): { body: Buffer; contentType: string } {
  const boundary = '----maservit' + crypto.randomBytes(10).toString('hex');
  const chunks: Buffer[] = [];
  for (const p of parts) {
    let head = `--${boundary}\r\nContent-Disposition: form-data; name="${p.name}"`;
    if (p.filename) head += `; filename="${p.filename}"`;
    head += `\r\nContent-Type: ${p.contentType}\r\n\r\n`;
    chunks.push(Buffer.from(head, 'utf8'));
    chunks.push(Buffer.isBuffer(p.data) ? p.data : Buffer.from(p.data, 'utf8'));
    chunks.push(Buffer.from('\r\n', 'utf8'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

/**
 * Enrola un rostro en el terminal a partir de una foto (JPEG), asociándolo al
 * empleado vía FPID. Requiere que el usuario ya exista en el dispositivo.
 */
export async function enrollFace(
  cfg: DeviceConfig,
  employeeNo: string,
  jpg: Buffer
): Promise<{ ok: boolean; message: string }> {
  const meta = JSON.stringify({ faceLibType: 'blackFD', FDID: '1', FPID: String(employeeNo) });
  const { body, contentType } = buildMultipart([
    { name: 'FaceDataRecord', contentType: 'application/json', data: meta },
    { name: 'img', filename: 'face.jpg', contentType: 'image/jpeg', data: jpg },
  ]);
  const r = await deviceRequest(
    cfg,
    'POST',
    '/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json',
    body,
    { 'Content-Type': contentType }
  );
  let message = `HTTP ${r.status}`;
  try {
    const j = JSON.parse(r.body.toString());
    message = j.statusString || j.subStatusCode || message;
  } catch {}
  return { ok: r.status === 200, message };
}

/**
 * Dispara la captura de una huella en el sensor del terminal. La persona debe
 * colocar el dedo en el equipo cuando se invoca. Devuelve la plantilla capturada.
 */
export async function captureFingerprint(
  cfg: DeviceConfig,
  fingerNo = 1
): Promise<{ ok: boolean; message: string; data?: any }> {
  const payload = JSON.stringify({ CaptureFingerPrintCond: { fingerNo } });
  const r = await deviceRequest(
    cfg,
    'POST',
    '/ISAPI/AccessControl/CaptureFingerPrint?format=json',
    payload,
    { 'Content-Type': 'application/json' }
  );
  let message = `HTTP ${r.status}`;
  let data: any;
  try {
    data = JSON.parse(r.body.toString());
    message = data.CaptureFingerPrint?.statusString || data.statusString || message;
  } catch {}
  return { ok: r.status === 200, message, data };
}

/** Guarda en el usuario la huella capturada previamente. */
export async function saveFingerprint(
  cfg: DeviceConfig,
  employeeNo: string,
  fingerNo: number,
  fingerData: string
): Promise<{ ok: boolean; message: string }> {
  const payload = JSON.stringify({
    FingerPrintCfg: {
      employeeNo: String(employeeNo),
      enableCardReader: [1],
      fingerPrintID: fingerNo,
      fingerType: 'normalFP',
      fingerData,
    },
  });
  const r = await deviceRequest(
    cfg,
    'PUT',
    '/ISAPI/AccessControl/FingerPrintCfg?format=json',
    payload,
    { 'Content-Type': 'application/json' }
  );
  let message = `HTTP ${r.status}`;
  try {
    const j = JSON.parse(r.body.toString());
    message = j.statusString || j.subStatusCode || message;
  } catch {}
  return { ok: r.status === 200, message };
}
