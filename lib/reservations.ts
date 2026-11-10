import type {
  BlockingInterval,
  Charger,
  ChargerWithContext,
  Conflict,
  Location,
  Reservation,
  ReservationDraft,
  Slot,
  ValidationIssue,
  ValidationResult,
} from "./types";

export const GRANULARITY_MINUTES = 30;

// America/Bogota es UTC-5 todo el año (no tiene horario de verano).
export const BOGOTA_UTC_OFFSET_MINUTES = -300;

const MS_PER_MINUTE = 60_000;

export type SessionInterval = {
  start: Date;
  end: Date;
  estimated: boolean;
  status: "active" | "ended";
};

export type ReservationRequestContext = {
  demoDate: string;
  minReservationMinutes: number;
  chargerContext: ChargerWithContext | null;
  reservations: Reservation[];
};

export function parseDateTime(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MS_PER_MINUTE);
}

/**
 * Desplaza el instante a la hora local de Bogotá para poder leer sus
 * componentes con los getters UTC sin depender de la zona del servidor.
 */
function toBogotaDate(date: Date): Date {
  return new Date(date.getTime() + BOGOTA_UTC_OFFSET_MINUTES * MS_PER_MINUTE);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toBogotaIso(date: Date): string {
  const local = toBogotaDate(date);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(
    local.getUTCHours(),
  )}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}-05:00`;
}

export function getBogotaMinutes(date: Date): number {
  const local = toBogotaDate(date);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

export function getBogotaDateKey(date: Date): string {
  const local = toBogotaDate(date);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function buildDemoDate(demoDate: string, minutes: number): Date {
  return new Date(`${demoDate}T${minutesToTime(minutes)}:00-05:00`);
}

export function formatTimeInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
}

export function overlaps(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();
}

export function getSessionInterval(charger: Charger): SessionInterval | null {
  const session = charger.session;
  if (!session) return null;

  const start = parseDateTime(session.startedAt);
  if (!start) return null;

  const realEnd = session.endedAt ? parseDateTime(session.endedAt) : null;
  const end = realEnd ?? addMinutes(start, charger.maxSessionHours * 60);

  if (end.getTime() <= start.getTime()) return null;

  return {
    start,
    end,
    estimated: realEnd === null,
    status: session.status,
  };
}

export function getBlockingIntervals(
  charger: Charger,
  location: Location,
  reservations: Reservation[],
): BlockingInterval[] {
  const intervals: BlockingInterval[] = [];
  const session = getSessionInterval(charger);

  if (session) {
    const endLabel = formatTimeInZone(session.end, location.timeZone);
    const startLabel = formatTimeInZone(session.start, location.timeZone);
    const isActive = session.status === "active";
    intervals.push({
      type: isActive ? "session-active" : "session-ended",
      start: session.start,
      end: session.end,
      label: isActive
        ? `Sesión activa hasta ${endLabel}${session.estimated ? " (estimada)" : ""}`
        : `Sesión finalizada ${startLabel}–${endLabel}`,
    });
  }

  for (const reservation of reservations) {
    if (reservation.chargerId !== charger.id || reservation.status !== "confirmed") continue;

    const start = parseDateTime(reservation.startAt);
    const end = parseDateTime(reservation.endAt);
    if (!start || !end || end.getTime() <= start.getTime()) continue;

    intervals.push({
      type: "reservation",
      id: reservation.id,
      start,
      end,
      label: `Reserva confirmada ${formatTimeInZone(start, location.timeZone)}–${formatTimeInZone(
        end,
        location.timeZone,
      )}`,
    });
  }

  return intervals.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function toConflict(interval: BlockingInterval): Conflict {
  return {
    type: interval.type,
    id: interval.id,
    startAt: toBogotaIso(interval.start),
    endAt: toBogotaIso(interval.end),
    label: interval.label,
  };
}

export function buildSlots(
  demoDate: string,
  location: Location,
  charger: Charger,
  reservations: Reservation[],
): Slot[] {
  const opening = timeToMinutes(location.openingTime);
  const closing = timeToMinutes(location.closingTime);
  const firstSlot = Math.ceil(opening / GRANULARITY_MINUTES) * GRANULARITY_MINUTES;
  const blocking = getBlockingIntervals(charger, location, reservations);
  const slots: Slot[] = [];

  for (let minute = firstSlot; minute + GRANULARITY_MINUTES <= closing; minute += GRANULARITY_MINUTES) {
    const start = buildDemoDate(demoDate, minute);
    const end = addMinutes(start, GRANULARITY_MINUTES);
    const conflicts = blocking
      .filter((interval) => overlaps(start, end, interval.start, interval.end))
      .map(toConflict);

    slots.push({
      startAt: toBogotaIso(start),
      endAt: toBogotaIso(end),
      available: conflicts.length === 0,
      reason: conflicts.length > 0 ? conflicts.map((conflict) => conflict.label).join(" · ") : null,
      conflicts,
    });
  }

  return slots;
}

export function findConflicts(
  chargerContext: ChargerWithContext,
  reservations: Reservation[],
  start: Date,
  end: Date,
): Conflict[] {
  return getBlockingIntervals(chargerContext.charger, chargerContext.location, reservations)
    .filter((interval) => overlaps(start, end, interval.start, interval.end))
    .map(toConflict);
}

function fail(
  code: ValidationIssue["code"],
  message: string,
  status: number,
  field?: string,
  conflicts?: Conflict[],
): ValidationResult {
  return { ok: false, issue: { code, message, status, field, conflicts } };
}

export function validateReservationRequest(
  body: unknown,
  context: ReservationRequestContext,
): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail("INVALID_BODY", "El cuerpo debe ser un objeto JSON.", 400);
  }

  const payload = body as Record<string, unknown>;

  const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
  if (!userId) {
    return fail("INVALID_USER", "Indica el usuario que hace la reserva.", 400, "userId");
  }
  if (userId.length > 80) {
    return fail("INVALID_USER", "El identificador de usuario es demasiado largo.", 400, "userId");
  }

  if (typeof payload.chargerId !== "string" || !payload.chargerId.trim()) {
    return fail("INVALID_BODY", "Indica el cargador que quieres reservar.", 400, "chargerId");
  }
  if (!context.chargerContext) {
    return fail(
      "CHARGER_NOT_FOUND",
      `El cargador "${payload.chargerId.trim()}" no existe.`,
      404,
      "chargerId",
    );
  }

  const { location, charger } = context.chargerContext;

  if (typeof payload.startAt !== "string") {
    return fail("INVALID_DATE", "Indica la hora de inicio de la reserva.", 400, "startAt");
  }

  const start = parseDateTime(payload.startAt);
  if (!start) {
    return fail("INVALID_DATE", "La hora de inicio no es una fecha válida.", 400, "startAt");
  }
  if (getBogotaDateKey(start) !== context.demoDate) {
    return fail(
      "INVALID_DATE",
      `La reserva debe ser para la fecha de demostración (${context.demoDate}).`,
      400,
      "startAt",
    );
  }

  let end: Date | null = null;
  let durationMinutes: number | null = null;

  if (payload.durationMinutes !== undefined) {
    if (
      typeof payload.durationMinutes !== "number" ||
      !Number.isInteger(payload.durationMinutes)
    ) {
      return fail(
        "INVALID_DURATION",
        "La duración debe ser un número entero de minutos.",
        400,
        "durationMinutes",
      );
    }
    durationMinutes = payload.durationMinutes;
    end = addMinutes(start, durationMinutes);
  }

  if (payload.endAt !== undefined) {
    if (typeof payload.endAt !== "string") {
      return fail("INVALID_DATE", "La hora de fin no es válida.", 400, "endAt");
    }
    const parsedEnd = parseDateTime(payload.endAt);
    if (!parsedEnd) {
      return fail("INVALID_DATE", "La hora de fin no es una fecha válida.", 400, "endAt");
    }
    if (end && parsedEnd.getTime() !== end.getTime()) {
      return fail(
        "INVALID_DURATION",
        "La duración y la hora de fin no coinciden.",
        400,
        "endAt",
      );
    }
    end = parsedEnd;
  }

  if (!end) {
    return fail(
      "INVALID_DURATION",
      "Indica la duración o la hora de fin de la reserva.",
      400,
      "durationMinutes",
    );
  }

  if (durationMinutes === null) {
    durationMinutes = Math.round((end.getTime() - start.getTime()) / MS_PER_MINUTE);
  }

  if (end.getTime() <= start.getTime()) {
    return fail("INVALID_DURATION", "La hora de fin debe ser posterior al inicio.", 400, "endAt");
  }

  if (durationMinutes < context.minReservationMinutes) {
    return fail(
      "INVALID_DURATION",
      `La reserva debe durar al menos ${context.minReservationMinutes} minutos.`,
      400,
      "durationMinutes",
    );
  }

  const maxMinutes = charger.maxSessionHours * 60;
  if (durationMinutes > maxMinutes) {
    return fail(
      "INVALID_DURATION",
      `La reserva máxima para ${charger.name} es de ${charger.maxSessionHours} horas.`,
      400,
      "durationMinutes",
    );
  }

  if (start.getTime() % MS_PER_MINUTE !== 0 || end.getTime() % MS_PER_MINUTE !== 0) {
    return fail(
      "INVALID_DURATION",
      "Los horarios deben estar en minutos exactos, sin segundos.",
      400,
      "startAt",
    );
  }

  const startMinutes = getBogotaMinutes(start);
  const endMinutes = getBogotaMinutes(end);

  if (
    startMinutes % GRANULARITY_MINUTES !== 0 ||
    endMinutes % GRANULARITY_MINUTES !== 0
  ) {
    return fail(
      "INVALID_DURATION",
      `Los horarios deben estar alineados a bloques de ${GRANULARITY_MINUTES} minutos.`,
      400,
      "startAt",
    );
  }

  if (getBogotaDateKey(end) !== context.demoDate) {
    return fail(
      "OUTSIDE_HOURS",
      "La reserva debe terminar el mismo día de la fecha de demostración.",
      400,
      "endAt",
    );
  }

  const opening = timeToMinutes(location.openingTime);
  const closing = timeToMinutes(location.closingTime);
  if (startMinutes < opening || endMinutes > closing) {
    return fail(
      "OUTSIDE_HOURS",
      `El horario de ${location.name} es de ${location.openingTime} a ${location.closingTime}.`,
      400,
      "startAt",
    );
  }

  const conflicts = findConflicts(context.chargerContext, context.reservations, start, end);
  if (conflicts.length > 0) {
    return fail(
      "RESERVATION_CONFLICT",
      `El horario se cruza con ${conflicts.map((conflict) => conflict.label).join(" · ")}.`,
      409,
      "startAt",
      conflicts,
    );
  }

  const draft: ReservationDraft = {
    userId,
    charger,
    location,
    startAt: toBogotaIso(start),
    endAt: toBogotaIso(end),
    durationMinutes,
    priceCop: charger.flatRateCop,
  };

  return { ok: true, draft };
}

export function createReservationRecord(draft: ReservationDraft, id: string): Reservation {
  return {
    id,
    userId: draft.userId,
    chargerId: draft.charger.id,
    startAt: draft.startAt,
    endAt: draft.endAt,
    priceCop: draft.priceCop,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };
}
