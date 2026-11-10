export type ChargerType = "AC" | "DC";

export type ChargerSessionStatus = "active" | "ended";

export type ChargerSession = {
  startedAt: string;
  endedAt: string | null;
  status: ChargerSessionStatus;
};

export type Charger = {
  id: string;
  name: string;
  type: ChargerType;
  maxSessionHours: number;
  flatRateCop: number;
  session: ChargerSession | null;
};

export type Zone = {
  id: string;
  name: string;
  chargers: Charger[];
};

export type Location = {
  id: string;
  name: string;
  city: string;
  timeZone: string;
  openingTime: string;
  closingTime: string;
  zones: Zone[];
};

export type StationsData = {
  demoDate: string;
  minReservationMinutes: number;
  reservationGraceMinutes: number;
  locations: Location[];
};

export type ReservationStatus = "confirmed";

export type Reservation = {
  id: string;
  userId: string;
  chargerId: string;
  startAt: string;
  endAt: string;
  priceCop: number;
  status: ReservationStatus;
  createdAt?: string;
};

export type ChargerWithContext = {
  location: Location;
  zone: Zone;
  charger: Charger;
};

export type ConflictType = "reservation" | "session-active" | "session-ended";

export type Conflict = {
  type: ConflictType;
  id?: string;
  startAt: string;
  endAt: string;
  label: string;
};

export type BlockingInterval = {
  type: ConflictType;
  id?: string;
  start: Date;
  end: Date;
  label: string;
};

export type Slot = {
  startAt: string;
  endAt: string;
  available: boolean;
  reason: string | null;
  conflicts: Conflict[];
};

export type ValidationErrorCode =
  | "INVALID_BODY"
  | "INVALID_USER"
  | "INVALID_DATE"
  | "INVALID_DURATION"
  | "OUTSIDE_HOURS"
  | "CHARGER_NOT_FOUND"
  | "RESERVATION_CONFLICT";

export type ValidationIssue = {
  code: ValidationErrorCode;
  message: string;
  field?: string;
  status: number;
  conflicts?: Conflict[];
};

export type ReservationDraft = {
  userId: string;
  charger: Charger;
  location: Location;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  priceCop: number;
};

export type ValidationResult =
  | { ok: true; draft: ReservationDraft }
  | { ok: false; issue: ValidationIssue };
