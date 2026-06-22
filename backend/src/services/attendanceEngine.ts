/**
 * Motor de asistencia basado en marcas crudas.
 *
 * Reglas:
 *  - Una marca dentro de `dedup_minutos` de la anterior se descarta (queda la
 *    más temprana): protege contra el doble marcado del operario.
 *  - Las marcas se agrupan en SESIONES separadas por un hueco mayor a
 *    `umbral_nueva_jornada_horas`. Una sesión puede cruzar la medianoche.
 *  - La 1ª marca de una sesión es ENTRADA.
 *  - Trabajando: si pasó >= `break_umbral_minutos` desde el inicio del tramo de
 *    trabajo, la marca abre el refrigerio (BREAK_IN).
 *  - En refrigerio: la siguiente marca lo cierra (BREAK_OUT) y se sigue trabajando.
 *  - La SALIDA no es un tipo almacenado: es la última marca de la sesión (se
 *    resuelve al calcular las horas).
 */

export interface PunchRecord {
  ts: number; // epoch ms
  tipo: string; // ENTRADA | BREAK_IN | BREAK_OUT | MARCA
}

export interface EngineConfig {
  dedup_minutos: number;
  break_umbral_minutos: number;
  umbral_nueva_jornada_horas: number;
}

export type PunchAction =
  | { action: 'ignore'; reason: string }
  | { action: 'insert'; tipo: 'ENTRADA' | 'BREAK_IN' | 'BREAK_OUT' | 'MARCA' };

/**
 * Clasifica una nueva marca dado el historial reciente del trabajador.
 * `recent` debe venir ordenado ascendente por ts e incluir al menos las marcas
 * de la jornada en curso (basta con las últimas ~12h).
 */
export function classifyPunch(
  nowTs: number,
  recent: PunchRecord[],
  cfg: EngineConfig
): PunchAction {
  if (recent.length === 0) {
    return { action: 'insert', tipo: 'ENTRADA' };
  }

  const last = recent[recent.length - 1];
  const deltaMin = (nowTs - last.ts) / 60000;

  // Dedup: misma marca repetida
  if (deltaMin <= cfg.dedup_minutos) {
    return { action: 'ignore', reason: 'doble marcado (dedup)' };
  }

  // ¿Nueva jornada? hueco grande respecto a la última marca
  const gapHoras = (nowTs - last.ts) / 3600000;
  if (gapHoras > cfg.umbral_nueva_jornada_horas) {
    return { action: 'insert', tipo: 'ENTRADA' };
  }

  // Reconstruir la sesión en curso (cadena hacia atrás con huecos <= umbral)
  const session: PunchRecord[] = [last];
  for (let i = recent.length - 2; i >= 0; i--) {
    const gap = (session[0].ts - recent[i].ts) / 3600000;
    if (gap > cfg.umbral_nueva_jornada_horas) break;
    session.unshift(recent[i]);
  }

  const breakIns = session.filter((p) => p.tipo === 'BREAK_IN').length;
  const breakOuts = session.filter((p) => p.tipo === 'BREAK_OUT').length;
  const onBreak = breakIns > breakOuts;

  if (onBreak) {
    return { action: 'insert', tipo: 'BREAK_OUT' };
  }

  // Trabajando: inicio del tramo = último BREAK_OUT o la entrada de la sesión
  let workStretchStart = session[0].ts;
  for (const p of session) {
    if (p.tipo === 'BREAK_OUT') workStretchStart = p.ts;
  }
  const workedMin = (nowTs - workStretchStart) / 60000;

  if (workedMin >= cfg.break_umbral_minutos) {
    return { action: 'insert', tipo: 'BREAK_IN' };
  }

  // Marca intermedia bajo el umbral de refrigerio: marca neutra
  return { action: 'insert', tipo: 'MARCA' };
}
