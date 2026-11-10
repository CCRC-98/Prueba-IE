import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  readReservations,
  withReservationsLock,
  writeReservations,
} from "@/lib/reservation-store";
import { createReservationRecord, validateReservationRequest } from "@/lib/reservations";
import { findChargerById, stationsData } from "@/lib/stations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getChargerId(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const value = (body as Record<string, unknown>).chargerId;
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim();

  try {
    const reservations = await readReservations();
    const filtered = userId
      ? reservations.filter((reservation) => reservation.userId === userId)
      : reservations;
    const sorted = [...filtered].sort((a, b) => a.startAt.localeCompare(b.startAt));

    return NextResponse.json({ reservations: sorted });
  } catch {
    return NextResponse.json(
      { error: "No se pudieron leer las reservas.", code: "READ_ERROR" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo debe ser JSON válido.", code: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const chargerId = getChargerId(body);
  const chargerContext = chargerId ? findChargerById(chargerId) : null;

  try {
    const result = await withReservationsLock(async () => {
      const reservations = await readReservations();
      const validation = validateReservationRequest(body, {
        demoDate: stationsData.demoDate,
        minReservationMinutes: stationsData.minReservationMinutes,
        chargerContext,
        reservations,
      });

      if (!validation.ok) return validation;

      const reservation = createReservationRecord(
        validation.draft,
        `res-${randomUUID()}`,
      );
      await writeReservations([...reservations, reservation]);

      return { ok: true as const, reservation };
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.issue.message,
          code: result.issue.code,
          field: result.issue.field,
          conflicts: result.issue.conflicts,
        },
        { status: result.issue.status },
      );
    }

    return NextResponse.json({ reservation: result.reservation }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "No se pudo guardar la reserva en el almacenamiento local.", code: "WRITE_ERROR" },
      { status: 500 },
    );
  }
}
