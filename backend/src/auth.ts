/**
 * Autenticación simple por contraseña única para el panel.
 * La contraseña NUNCA se guarda en texto: se compara contra un hash bcrypt.
 * Tras el login se emite un token firmado con HMAC-SHA256 (sin dependencias extra).
 *
 * Configurable por entorno:
 *   AUTH_PASSWORD_HASH  hash bcrypt de la contraseña (si no, usa el embebido)
 *   AUTH_SECRET         secreto para firmar los tokens (cámbialo en producción)
 *   AUTH_TOKEN_TTL_H    duración del token en horas (def. 12)
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { RequestHandler } from 'express';

// Hash bcrypt de la contraseña por defecto ("maservit.1"). Solo el hash, sin texto plano.
const DEFAULT_HASH = '$2b$12$AKnSpUZn5aBsRd0cZlWSKOCxt3ox3kTnu.Y6dIdd92ms8IV9uN.ee';

const PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH || DEFAULT_HASH;
const SECRET = process.env.AUTH_SECRET || 'maservit-dev-secret-cambiar-en-produccion';
const TOKEN_TTL_MS = Number(process.env.AUTH_TOKEN_TTL_H || 12) * 3600 * 1000;

/** Verifica la contraseña enviada contra el hash bcrypt. */
export async function verifyPassword(password: string): Promise<boolean> {
  if (!password) return false;
  return bcrypt.compare(password, PASSWORD_HASH);
}

/** Emite un token firmado (payload.firma) con expiración. */
export function issueToken(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** Valida firma y expiración de un token. */
export function verifyToken(token: string): boolean {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && Date.now() < exp;
  } catch {
    return false;
  }
}

/**
 * Middleware que exige un token válido. Lo acepta como cabecera
 * `Authorization: Bearer <token>` o como query `?token=` (para <img>, descargas y SSE).
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers['authorization'];
  let token = header && header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token && typeof req.query.token === 'string') token = req.query.token;
  if (token && verifyToken(token)) return next();
  res.status(401).json({ success: false, message: 'No autorizado' });
};

/** Handler del endpoint de login. */
export const loginHandler: RequestHandler = async (req, res) => {
  try {
    const password = (req.body && req.body.password) || '';
    if (await verifyPassword(password)) {
      res.status(200).json({ success: true, token: issueToken() });
    } else {
      res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
    }
  } catch {
    res.status(500).json({ success: false, message: 'Error de autenticación' });
  }
};
