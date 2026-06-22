/**
 * Calculadora de horas trabajadas y monto a pagar.
 *
 * A partir de las marcas crudas de un trabajador reconstruye sesiones (que
 * pueden cruzar la medianoche), separa los tramos de trabajo de los refrigerios
 * y clasifica cada minuto trabajado en cuatro categorías:
 *   - día normal, noche normal, día extra, noche extra
 * aplicando los multiplicadores globales y la tarifa base del trabajador.
 */

export interface PayConfig {
  umbral_nueva_jornada_horas: number;
  nocturno_inicio: string; // "HH:MM"
  nocturno_fin: string; // "HH:MM"
  mult_nocturno: number;
  horas_jornada_normal: number;
  mult_extra: number;
}

export interface CalcPunch {
  ts: number; // epoch ms
  tipo: string;
}

export interface SessionResult {
  fecha: string; // fecha local de la entrada (YYYY-MM-DD)
  entrada: number;
  salida: number;
  trabajadoMin: number;
  refrigerioMin: number;
  diaNormalMin: number;
  nocheNormalMin: number;
  diaExtraMin: number;
  nocheExtraMin: number;
  monto: number;
  cruzaMedianoche: boolean;
}

export interface WorkerReport {
  sessions: SessionResult[];
  totalTrabajadoH: number;
  totalRefrigerioH: number;
  diaNormalH: number;
  nocheNormalH: number;
  diaExtraH: number;
  nocheExtraH: number;
  extraH: number; // dia + noche extra
  nocturnasH: number; // noche normal + noche extra
  montoTotal: number;
  sesionesCount: number;
}

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

function minuteOfDay(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

function isNight(ts: number, cfg: PayConfig): boolean {
  const t = minuteOfDay(ts);
  const start = toMin(cfg.nocturno_inicio);
  const end = toMin(cfg.nocturno_fin);
  if (start === end) return false;
  if (start < end) return t >= start && t < end;
  return t >= start || t < end; // ventana que cruza medianoche
}

function localDate(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface Interval {
  start: number;
  end: number;
}

/** Agrupa marcas en sesiones separadas por huecos grandes. */
export function buildSessions(punches: CalcPunch[], umbralHoras: number): CalcPunch[][] {
  const sorted = [...punches].sort((a, b) => a.ts - b.ts);
  const sessions: CalcPunch[][] = [];
  let current: CalcPunch[] = [];
  for (const p of sorted) {
    if (current.length === 0) {
      current.push(p);
      continue;
    }
    const gapH = (p.ts - current[current.length - 1].ts) / 3600000;
    if (gapH > umbralHoras) {
      sessions.push(current);
      current = [p];
    } else {
      current.push(p);
    }
  }
  if (current.length) sessions.push(current);
  return sessions;
}

/** Extrae los tramos de trabajo y de refrigerio de una sesión. */
function splitIntervals(session: CalcPunch[]): { work: Interval[]; breaks: Interval[]; salida: number } {
  const work: Interval[] = [];
  const breaks: Interval[] = [];
  let state: 'work' | 'break' = 'work';
  let workStart = session[0].ts;
  let breakStart = 0;
  let salida = session[session.length - 1].ts;

  for (let i = 1; i < session.length; i++) {
    const p = session[i];
    if (p.tipo === 'BREAK_IN' && state === 'work') {
      work.push({ start: workStart, end: p.ts });
      breakStart = p.ts;
      state = 'break';
    } else if (p.tipo === 'BREAK_OUT' && state === 'break') {
      breaks.push({ start: breakStart, end: p.ts });
      workStart = p.ts;
      state = 'work';
    }
    // MARCA / ENTRADA intermedios: no cambian de estado
  }

  if (state === 'work') {
    work.push({ start: workStart, end: salida });
  } else {
    // Quedó en refrigerio sin retorno: el inicio del refrigerio es la salida real
    salida = breakStart;
  }

  return { work, breaks, salida };
}

/** Calcula el reporte completo de un trabajador. */
export function computeWorkerReport(
  punches: CalcPunch[],
  cfg: PayConfig,
  tarifaHora: number
): WorkerReport {
  const sessions = buildSessions(punches, cfg.umbral_nueva_jornada_horas);
  const results: SessionResult[] = [];
  const normalThresholdMin = cfg.horas_jornada_normal * 60;

  for (const session of sessions) {
    if (session.length === 0) continue;
    const { work, breaks, salida } = splitIntervals(session);

    let diaNormal = 0,
      nocheNormal = 0,
      diaExtra = 0,
      nocheExtra = 0,
      trabajado = 0;
    let cum = 0; // minutos acumulados de la sesión (para horas extra)

    for (const iv of work) {
      const startMin = Math.floor(iv.start / 60000);
      const endMin = Math.floor(iv.end / 60000);
      for (let m = startMin; m < endMin; m++) {
        const ts = m * 60000;
        const night = isNight(ts, cfg);
        const extra = cum >= normalThresholdMin;
        if (extra && night) nocheExtra++;
        else if (extra) diaExtra++;
        else if (night) nocheNormal++;
        else diaNormal++;
        cum++;
        trabajado++;
      }
    }

    const refrigerioMin = breaks.reduce((s, b) => s + (b.end - b.start) / 60000, 0);

    const rate = tarifaHora;
    const monto =
      (diaNormal * rate +
        nocheNormal * rate * cfg.mult_nocturno +
        diaExtra * rate * cfg.mult_extra +
        nocheExtra * rate * cfg.mult_nocturno * cfg.mult_extra) /
      60;

    results.push({
      fecha: localDate(session[0].ts),
      entrada: session[0].ts,
      salida,
      trabajadoMin: trabajado,
      refrigerioMin: Math.round(refrigerioMin),
      diaNormalMin: diaNormal,
      nocheNormalMin: nocheNormal,
      diaExtraMin: diaExtra,
      nocheExtraMin: nocheExtra,
      monto,
      cruzaMedianoche: localDate(session[0].ts) !== localDate(salida),
    });
  }

  const sum = (f: (s: SessionResult) => number) => results.reduce((a, s) => a + f(s), 0);
  const h = (min: number) => Math.round((min / 60) * 100) / 100;

  return {
    sessions: results,
    totalTrabajadoH: h(sum((s) => s.trabajadoMin)),
    totalRefrigerioH: h(sum((s) => s.refrigerioMin)),
    diaNormalH: h(sum((s) => s.diaNormalMin)),
    nocheNormalH: h(sum((s) => s.nocheNormalMin)),
    diaExtraH: h(sum((s) => s.diaExtraMin)),
    nocheExtraH: h(sum((s) => s.nocheExtraMin)),
    extraH: h(sum((s) => s.diaExtraMin + s.nocheExtraMin)),
    nocturnasH: h(sum((s) => s.nocheNormalMin + s.nocheExtraMin)),
    montoTotal: Math.round(sum((s) => s.monto) * 100) / 100,
    sesionesCount: results.length,
  };
}
