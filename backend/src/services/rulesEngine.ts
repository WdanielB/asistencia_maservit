export interface Schedule {
  id: number;
  nombre: string;
  hora_entrada: string; // HH:MM
  hora_salida: string;  // HH:MM
  minutos_tolerancia: number;
  break_duracion: number; // en minutos
}

export interface AttendanceLog {
  id?: number;
  trabajador_id: number;
  fecha: string;
  hora: string;
  tipo: 'ENTRADA' | 'BREAK_IN' | 'BREAK_OUT' | 'SALIDA';
  estado: 'PUNTUAL' | 'TARDANZA' | 'CORRECTO';
  foto_scan_url?: string;
}

/**
 * Motor de Reglas Inteligente para Clasificación de Marcaciones
 * 
 * Este servicio deduce automáticamente si una marcación corresponde a:
 * - ENTRADA: Marcación al inicio de la jornada laboral.
 * - BREAK_IN: Salida a almorzar/descanso.
 * - BREAK_OUT: Retorno del almuerzo/descanso.
 * - SALIDA: Fin de la jornada laboral.
 * 
 * Resuelve el clásico problema de marcaciones desordenadas o duplicadas
 * usando ventanas de tiempo relativas al horario asignado.
 */
export function classifyScan(
  currentTimeStr: string, // "HH:MM:SS"
  existingLogsToday: AttendanceLog[],
  schedule: Schedule
): { tipo: 'ENTRADA' | 'BREAK_IN' | 'BREAK_OUT' | 'SALIDA'; estado: 'PUNTUAL' | 'TARDANZA' | 'CORRECTO' } {
  
  const [scanH, scanM, scanS] = currentTimeStr.split(':').map(Number);
  const scanInMinutes = scanH * 60 + scanM;

  const [inH, inM] = schedule.hora_entrada.split(':').map(Number);
  const scheduledInMinutes = inH * 60 + inM;

  const [outH, outM] = schedule.hora_salida.split(':').map(Number);
  const scheduledOutMinutes = outH * 60 + outM;

  // Tolerancia de entrada
  const maxOnTimeMinutes = scheduledInMinutes + schedule.minutos_tolerancia;

  // Buscar marcaciones previas hoy
  const hasEntrada = existingLogsToday.find(l => l.tipo === 'ENTRADA');
  const hasBreakIn = existingLogsToday.find(l => l.tipo === 'BREAK_IN');
  const hasBreakOut = existingLogsToday.find(l => l.tipo === 'BREAK_OUT');
  const hasSalida = existingLogsToday.find(l => l.tipo === 'SALIDA');

  // 1. Si no hay marcación de ENTRADA hoy, y estamos antes del mediodía laboral, o simplemente es la primera marcación
  if (!hasEntrada) {
    // Si la marcación es muy tarde (por ejemplo, después de la mitad de la jornada),
    // pero sigue siendo la primera, la tomamos como Entrada, pero con Tardanza.
    const estado = scanInMinutes <= maxOnTimeMinutes ? 'PUNTUAL' : 'TARDANZA';
    return { tipo: 'ENTRADA', estado };
  }

  // 2. Si ya tiene ENTRADA pero no tiene BREAK_IN
  // Típicamente los breaks ocurren a mitad de jornada (ej: de 11:30 a 14:30)
  // O si la marcación ocurre al menos 3 horas después de la entrada y falten más de 2 horas para la salida
  const minutesSinceEntrada = getMinutesSinceStart(hasEntrada.hora, currentTimeStr);
  const isAroundLunchTime = scanInMinutes >= 11 * 60 + 30 && scanInMinutes <= 15 * 60; // 11:30 a 15:00

  if (!hasBreakIn && !hasSalida) {
    // Si marcación es en horario de almuerzo o pasaron al menos 3 horas desde la entrada,
    // y todavía falta bastante para la salida planificada, clasificamos como salida a Break.
    const hoursRemaining = scheduledOutMinutes - scanInMinutes;
    
    if (isAroundLunchTime || (minutesSinceEntrada >= 180 && hoursRemaining > 90)) {
      return { tipo: 'BREAK_IN', estado: 'CORRECTO' };
    }
  }

  // 3. Si ya tiene BREAK_IN pero no BREAK_OUT
  if (hasBreakIn && !hasBreakOut && !hasSalida) {
    const minutesInBreak = getMinutesSinceStart(hasBreakIn.hora, currentTimeStr);
    
    // Evitamos registrar un retorno de break si acaban de marcar hace menos de 10 minutos (doble escaneo accidental)
    if (minutesInBreak >= 10) {
      return { tipo: 'BREAK_OUT', estado: 'CORRECTO' };
    }
  }

  // 4. Caso por defecto: SALIDA
  // Si ya tiene Entrada, y ocurre después de la hora de salida planificada o pasaron más de 6 horas desde la entrada.
  // O si ya completó el ciclo de Break.
  return { tipo: 'SALIDA', estado: 'CORRECTO' };
}

function getMinutesSinceStart(startTimeStr: string, endTimeStr: string): number {
  const [startH, startM] = startTimeStr.split(':').map(Number);
  const [endH, endM] = endTimeStr.split(':').map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}
