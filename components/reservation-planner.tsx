"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { GRANULARITY_MINUTES } from "@/lib/reservations";
import type {
  ChargerWithContext,
  Reservation,
  Slot,
  StationsData,
} from "@/lib/types";

type AvailabilityResponse = {
  chargerId: string;
  date: string;
  granularityMinutes: number;
  slots: Slot[];
};

type ReservationResponse = {
  reservation?: Reservation;
  error?: string;
};

type ReservationsListResponse = {
  reservations?: Reservation[];
  error?: string;
};

type DurationOption = {
  minutes: number;
  disabled: boolean;
  reason: string | null;
};

const DEFAULT_USER_ID = "usuario-demo";

function formatCop(value: number): string {
  const formatted = Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$ ${formatted}`;
}

function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(new Date(iso));
}

const MONTHS_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function formatDemoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  const monthName = MONTHS_ES[Number(month) - 1] ?? month;
  return `${day} ${monthName} ${year}`;
}

function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

function findChargerInStations(
  stations: StationsData,
  chargerId: string,
): ChargerWithContext | null {
  for (const location of stations.locations) {
    for (const zone of location.zones) {
      const charger = zone.chargers.find((item) => item.id === chargerId);
      if (charger) return { location, zone, charger };
    }
  }
  return null;
}

function getFirstSelection(stations: StationsData) {
  const location = stations.locations[0];
  const zone = location?.zones[0];
  const charger = zone?.chargers[0];
  return {
    locationId: location?.id ?? "",
    zoneId: zone?.id ?? "",
    chargerId: charger?.id ?? "",
  };
}

async function requestAvailability(chargerId: string): Promise<Slot[]> {
  const response = await fetch(
    `/api/availability?chargerId=${encodeURIComponent(chargerId)}`,
    { cache: "no-store" },
  );
  const data = (await response.json().catch(() => null)) as
    | AvailabilityResponse
    | { error?: string }
    | null;

  if (!response.ok || !data || !("slots" in data) || !Array.isArray(data.slots)) {
    const message =
      data && "error" in data && typeof data.error === "string"
        ? data.error
        : "No se pudo cargar la disponibilidad.";
    throw new Error(message);
  }

  return data.slots;
}

async function requestReservations(userId: string): Promise<Reservation[]> {
  const response = await fetch(
    `/api/reservations?userId=${encodeURIComponent(userId)}`,
    { cache: "no-store" },
  );
  const data = (await response.json().catch(() => null)) as
    | ReservationsListResponse
    | null;

  if (!response.ok || !data || !Array.isArray(data.reservations)) {
    throw new Error(data?.error ?? "No se pudieron cargar las reservas.");
  }

  return data.reservations;
}

export default function ReservationPlanner({ stations }: { stations: StationsData }) {
  const initialSelection = useMemo(() => getFirstSelection(stations), [stations]);

  const [userId, setUserId] = useState(DEFAULT_USER_ID);
  const [locationId, setLocationId] = useState(initialSelection.locationId);
  const [zoneId, setZoneId] = useState(initialSelection.zoneId);
  const [chargerId, setChargerId] = useState(initialSelection.chargerId);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(
    Boolean(initialSelection.chargerId),
  );
  const [availabilityError, setAvailabilityError] = useState("");

  const [startAt, setStartAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [hoveredSlot, setHoveredSlot] = useState<Slot | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState<Reservation | null>(null);

  const [myReservations, setMyReservations] = useState<Reservation[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(true);
  const [reservationsError, setReservationsError] = useState("");

  const selectedLocation = useMemo(
    () =>
      stations.locations.find((location) => location.id === locationId) ??
      stations.locations[0],
    [stations, locationId],
  );

  const selectedZone = useMemo(
    () =>
      selectedLocation?.zones.find((zone) => zone.id === zoneId) ??
      selectedLocation?.zones[0],
    [selectedLocation, zoneId],
  );

  const selectedCharger = useMemo(
    () =>
      selectedZone?.chargers.find((charger) => charger.id === chargerId) ??
      selectedZone?.chargers[0],
    [selectedZone, chargerId],
  );

  const timeZone = selectedLocation?.timeZone ?? "America/Bogota";
  const hasUser = Boolean(userId.trim());

  useEffect(() => {
    if (!chargerId) return;

    let cancelled = false;

    requestAvailability(chargerId)
      .then((nextSlots) => {
        if (!cancelled) setSlots(nextSlots);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSlots([]);
        setAvailabilityError(
          error instanceof Error
            ? error.message
            : "No se pudo cargar la disponibilidad.",
        );
      })
      .finally(() => {
        if (!cancelled) setAvailabilityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chargerId]);

  useEffect(() => {
    const trimmedUser = userId.trim();
    if (!trimmedUser) return;

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setMyReservations([]);
      setReservationsLoading(true);
      setReservationsError("");

      requestReservations(trimmedUser)
        .then((items) => {
          if (!cancelled) setMyReservations(items);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setMyReservations([]);
          setReservationsError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar las reservas.",
          );
        })
        .finally(() => {
          if (!cancelled) setReservationsLoading(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [userId]);

  const durationOptions = useMemo<DurationOption[]>(() => {
    if (!selectedCharger || !startAt) return [];

    const startIndex = slots.findIndex((slot) => slot.startAt === startAt);
    if (startIndex < 0) return [];

    const maxMinutes = selectedCharger.maxSessionHours * 60;
    const options: DurationOption[] = [];

    for (
      let minutes = 60;
      minutes <= maxMinutes;
      minutes += GRANULARITY_MINUTES
    ) {
      const count = minutes / GRANULARITY_MINUTES;
      const range = slots.slice(startIndex, startIndex + count);

      if (range.length < count) {
        options.push({
          minutes,
          disabled: true,
          reason: "La reserva terminaría después del cierre.",
        });
        continue;
      }

      const blocked = range.find((slot) => !slot.available);
      if (blocked) {
        options.push({
          minutes,
          disabled: true,
          reason: blocked.reason ?? "Hay un bloqueo en el rango.",
        });
        continue;
      }

      options.push({ minutes, disabled: false, reason: null });
    }

    return options;
  }, [selectedCharger, startAt, slots]);

  const selectedDurationOption =
    durationOptions.find((option) => option.minutes === durationMinutes) ?? null;

  const selectedRange = useMemo(() => {
    if (!startAt) return null;

    const startIndex = slots.findIndex((slot) => slot.startAt === startAt);
    if (startIndex < 0) return null;

    const count = durationMinutes / GRANULARITY_MINUTES;
    const range = slots.slice(startIndex, startIndex + count);
    if (range.length < count) return null;

    return {
      startAt: range[0].startAt,
      endAt: range[range.length - 1].endAt,
    };
  }, [startAt, durationMinutes, slots]);

  const blockedReasons = useMemo(() => {
    const reasons = new Set<string>();
    for (const slot of slots) {
      if (!slot.available && slot.reason) reasons.add(slot.reason);
    }
    return Array.from(reasons);
  }, [slots]);

  const allDurationsBlocked =
    durationOptions.length > 0 && durationOptions.every((option) => option.disabled);

  const canSubmit = Boolean(
    selectedCharger &&
      startAt &&
      selectedDurationOption &&
      !selectedDurationOption.disabled &&
      userId.trim() &&
      !submitting,
  );

  function resetSelection() {
    setSlots([]);
    setStartAt("");
    setDurationMinutes(60);
    setSuccess(null);
    setFormError("");
    setHoveredSlot(null);
    setAvailabilityError("");
  }

  function handleLocationChange(nextLocationId: string) {
    const nextLocation = stations.locations.find(
      (location) => location.id === nextLocationId,
    );
    const nextZone = nextLocation?.zones[0];
    const nextCharger = nextZone?.chargers[0];
    const nextChargerId = nextCharger?.id ?? "";

    setLocationId(nextLocationId);
    setZoneId(nextZone?.id ?? "");
    setChargerId(nextChargerId);

    if (nextChargerId !== chargerId) {
      resetSelection();
      setAvailabilityLoading(Boolean(nextChargerId));
      if (!nextChargerId) setSlots([]);
    }
  }

  function handleZoneChange(nextZoneId: string) {
    const nextZone = selectedLocation?.zones.find((zone) => zone.id === nextZoneId);
    const nextCharger = nextZone?.chargers[0];
    const nextChargerId = nextCharger?.id ?? "";

    setZoneId(nextZoneId);
    setChargerId(nextChargerId);

    if (nextChargerId !== chargerId) {
      resetSelection();
      setAvailabilityLoading(Boolean(nextChargerId));
      if (!nextChargerId) setSlots([]);
    }
  }

  function handleChargerChange(nextChargerId: string) {
    if (nextChargerId === chargerId) return;

    setChargerId(nextChargerId);
    resetSelection();
    setAvailabilityLoading(Boolean(nextChargerId));
    if (!nextChargerId) setSlots([]);
  }

  function handleSelectSlot(slot: Slot) {
    if (!slot.available) return;

    setStartAt(slot.startAt);
    setDurationMinutes(60);
    setFormError("");
    setSuccess(null);
  }

  async function refreshData(targetChargerId: string, targetUserId: string) {
    try {
      const nextSlots = await requestAvailability(targetChargerId);
      setSlots(nextSlots);
    } catch (error) {
      setAvailabilityError(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la disponibilidad.",
      );
    }

    try {
      const items = await requestReservations(targetUserId);
      setMyReservations(items);
    } catch (error) {
      setReservationsError(
        error instanceof Error
          ? error.message
          : "No se pudieron actualizar las reservas.",
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccess(null);

    if (!selectedCharger || !startAt) {
      setFormError("Selecciona un cargador y un horario de inicio.");
      return;
    }

    if (!selectedDurationOption || selectedDurationOption.disabled) {
      setFormError(
        selectedDurationOption?.reason ?? "Selecciona una duración válida.",
      );
      return;
    }

    const trimmedUser = userId.trim();
    if (!trimmedUser) {
      setFormError("Indica el usuario que hace la reserva.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: trimmedUser,
          chargerId: selectedCharger.id,
          startAt,
          durationMinutes,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | ReservationResponse
        | null;

      if (!response.ok || !data?.reservation) {
        throw new Error(data?.error ?? "No se pudo crear la reserva.");
      }

      setSuccess(data.reservation);
      setStartAt("");
      setDurationMinutes(60);
      void refreshData(selectedCharger.id, trimmedUser);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "No se pudo crear la reserva.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const successContext = success
    ? findChargerInStations(stations, success.chargerId)
    : null;

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <div className="brand">
            <span className="brand-mark">↯</span> Electromovilidad · Aplicativos
          </div>
          <span className="top-note">Entorno local de evaluación · Datos ficticios</span>
        </div>
      </header>

      <main className="shell main">
        <div className="page-heading">
          <div>
            <p className="eyebrow" style={{ color: "var(--green)" }}>
              Fase 2 · Reservas
            </p>
            <h1>Reserva tu cargador</h1>
            <p>
              Fecha de demostración: {formatDemoDate(stations.demoDate)} ·
              Bloques de {GRANULARITY_MINUTES} minutos · Zona horaria de Colombia
            </p>
          </div>
          <Link className="back-link" href="/#desarrollo">
            ← Volver al enunciado
          </Link>
        </div>

        <div className="planner">
          <div className="planner-top">
            <section className="card planner-card">
              <div className="planner-header">
                <div>
                  <h2>Nueva reserva</h2>
                  <p>Elige cargador, inicio y duración. La tarifa es plana por reserva.</p>
                </div>
                <span className="tag tag-given">
                  Fecha fija: {formatDemoDate(stations.demoDate)}
                </span>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="planner-form-grid">
                  <label>
                    <span className="field-label">Usuario</span>
                    <input
                      className="text-input"
                      value={userId}
                      maxLength={80}
                      onChange={(event) => {
                        setUserId(event.target.value);
                        setMyReservations([]);
                        setReservationsError("");
                        setReservationsLoading(true);
                      }}
                      placeholder="usuario-demo"
                    />
                  </label>

                  <label>
                    <span className="field-label">Localidad</span>
                    <select
                      className="select-input"
                      value={selectedLocation?.id ?? ""}
                      onChange={(event) => handleLocationChange(event.target.value)}
                    >
                      {stations.locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name} · {location.city}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span className="field-label">Zona</span>
                    <select
                      className="select-input"
                      value={selectedZone?.id ?? ""}
                      onChange={(event) => handleZoneChange(event.target.value)}
                    >
                      {selectedLocation?.zones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span className="field-label">Cargador</span>
                    <select
                      className="select-input"
                      value={selectedCharger?.id ?? ""}
                      onChange={(event) => handleChargerChange(event.target.value)}
                    >
                      {selectedZone?.chargers.map((charger) => (
                        <option key={charger.id} value={charger.id}>
                          {charger.name} · {charger.type}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {selectedCharger && selectedLocation && (
                  <div className="charger-summary">
                    <span>
                      <strong>{selectedCharger.name}</strong> · {selectedCharger.type}
                    </span>
                    <span>Máximo de sesión: {selectedCharger.maxSessionHours} h</span>
                    <span>Tarifa plana: {formatCop(selectedCharger.flatRateCop)}</span>
                    <span>
                      Horario: {selectedLocation.openingTime}–{selectedLocation.closingTime}
                    </span>
                  </div>
                )}

                <div className="reservation-summary">
                  <div>
                    <span className="field-label">Inicio</span>
                    <strong>{startAt ? formatTime(startAt, timeZone) : "Selecciona un slot"}</strong>
                  </div>

                  <div>
                    <span className="field-label">Fin</span>
                    <strong>
                      {selectedRange &&
                      selectedDurationOption &&
                      !selectedDurationOption.disabled
                        ? formatTime(selectedRange.endAt, timeZone)
                        : "—"}
                    </strong>
                  </div>

                  <div>
                    <span className="field-label">Duración</span>
                    <select
                      className="select-input"
                      value={durationMinutes}
                      disabled={!startAt || durationOptions.length === 0}
                      onChange={(event) =>
                        setDurationMinutes(Number(event.target.value))
                      }
                    >
                      {durationOptions.length === 0 ? (
                        <option value={durationMinutes}>
                          {durationLabel(durationMinutes)}
                        </option>
                      ) : (
                        durationOptions.map((option) => (
                          <option
                            key={option.minutes}
                            value={option.minutes}
                            disabled={option.disabled}
                          >
                            {durationLabel(option.minutes)}
                            {option.disabled ? ` — ${option.reason}` : ""}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <span className="field-label">Total</span>
                    <strong>
                      {selectedCharger ? formatCop(selectedCharger.flatRateCop) : "—"}
                    </strong>
                  </div>
                </div>

                {allDurationsBlocked && (
                  <p className="hint-text">
                    No hay una duración válida desde este inicio; elige otro slot.
                  </p>
                )}

                {formError && (
                  <p className="error-message" role="alert">
                    {formError}
                  </p>
                )}

                {success && (
                  <div className="success-card" role="status">
                    <strong>Reserva confirmada</strong>
                    <p>
                      {success.id} ·{" "}
                      {successContext?.charger.name ?? success.chargerId} ·{" "}
                      {formatTime(
                        success.startAt,
                        successContext?.location.timeZone ?? "America/Bogota",
                      )}
                      –
                      {formatTime(
                        success.endAt,
                        successContext?.location.timeZone ?? "America/Bogota",
                      )}{" "}
                      · {formatCop(success.priceCop)}
                    </p>
                  </div>
                )}

                <div className="planner-actions">
                  <button className="button" type="submit" disabled={!canSubmit}>
                    {submitting ? "Guardando…" : "Confirmar reserva"}
                  </button>
                  <span className="hint-count">
                    La reserva se guarda en data/reservations.json.
                  </span>
                </div>
              </form>
            </section>

            <section className="card planner-card">
              <div className="planner-header">
                <div>
                  <h2>Disponibilidad</h2>
                  <p>
                    {selectedLocation?.name} · {selectedLocation?.city} ·{" "}
                    {selectedLocation?.openingTime}–{selectedLocation?.closingTime}
                  </p>
                </div>
                <div className="legend" aria-label="Leyenda de disponibilidad">
                  <span className="legend-item">
                    <span className="legend-dot free" /> Libre
                  </span>
                  <span className="legend-item">
                    <span className="legend-dot busy" /> Bloqueado
                  </span>
                  <span className="legend-item">
                    <span className="legend-dot selected" /> Seleccionado
                  </span>
                </div>
              </div>

              {availabilityLoading && (
                <p className="muted">Cargando disponibilidad…</p>
              )}

              {availabilityError && (
                <p className="error-message" role="alert">
                  {availabilityError}
                </p>
              )}

              {!availabilityLoading &&
                !availabilityError &&
                slots.length === 0 && (
                  <p className="muted">No hay slots para este cargador.</p>
                )}

              <div className="slot-grid">
                {slots.map((slot) => {
                  const selected = slot.startAt === startAt;
                  return (
                    <button
                      key={slot.startAt}
                      type="button"
                      className={`slot${selected ? " selected" : ""}${
                        slot.available ? "" : " blocked"
                      }`}
                      disabled={!slot.available}
                      aria-pressed={selected}
                      aria-label={`${formatTime(slot.startAt, timeZone)}${
                        slot.available ? "" : `, bloqueado: ${slot.reason}`
                      }`}
                      title={slot.reason ?? "Disponible"}
                      onClick={() => handleSelectSlot(slot)}
                      onMouseEnter={() => setHoveredSlot(slot)}
                      onFocus={() => setHoveredSlot(slot)}
                      onMouseLeave={() => setHoveredSlot(null)}
                      onBlur={() => setHoveredSlot(null)}
                    >
                      <span className="slot-time">
                        {formatTime(slot.startAt, timeZone)}
                      </span>
                      {!slot.available && (
                        <span className="slot-lock">Bloqueado</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {hoveredSlot && !hoveredSlot.available && (
                <p className="slot-detail" role="status">
                  {hoveredSlot.reason}
                </p>
              )}

              {blockedReasons.length > 0 && (
                <div className="blocked-reasons">
                  <h3>Por qué hay slots bloqueados</h3>
                  <ul>
                    {blockedReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>

          <section className="card planner-card">
            <div className="planner-header">
              <div>
                <h2>Mis reservas</h2>
                <p>
                  Reservas de {userId.trim() || "—"} en la fecha de demostración.
                </p>
              </div>
              {reservationsLoading && hasUser && <span className="muted">Cargando…</span>}
            </div>

            {!hasUser && (
              <p className="muted">Indica un usuario para ver sus reservas.</p>
            )}

            {hasUser && reservationsError && (
              <p className="error-message" role="alert">
                {reservationsError}
              </p>
            )}

            {hasUser &&
              !reservationsLoading &&
              !reservationsError &&
              myReservations.length === 0 && (
                <p className="muted">No hay reservas para este usuario.</p>
              )}

            {hasUser && myReservations.length > 0 && (
              <ul className="reservation-list">
                {myReservations.map((reservation) => {
                  const context = findChargerInStations(
                    stations,
                    reservation.chargerId,
                  );
                  const reservationTimeZone =
                    context?.location.timeZone ?? "America/Bogota";

                  return (
                    <li key={reservation.id}>
                      <div>
                        <strong>
                          {context?.charger.name ?? reservation.chargerId}
                        </strong>
                        <span>{context?.location.name ?? ""}</span>
                      </div>
                      <div>
                        {formatTime(reservation.startAt, reservationTimeZone)}–
                        {formatTime(reservation.endAt, reservationTimeZone)}
                      </div>
                      <div>{formatCop(reservation.priceCop)}</div>
                      <span className="status">
                        {reservation.status === "confirmed"
                          ? "Confirmada"
                          : reservation.status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
