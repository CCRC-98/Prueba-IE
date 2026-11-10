import { NextResponse } from "next/server";
import { readReservations } from "@/lib/reservation-store";
import { buildSlots, GRANULARITY_MINUTES } from "@/lib/reservations";
import { findChargerById, stationsData } from "@/lib/stations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chargerId = searchParams.get("chargerId")?.trim();

  if (!chargerId) {
    return NextResponse.json(
      { error: "Indica el cargador con el parámetro chargerId.", code: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const chargerContext = findChargerById(chargerId);
  if (!chargerContext) {
    return NextResponse.json(
      { error: `El cargador "${chargerId}" no existe.`, code: "CHARGER_NOT_FOUND" },
      { status: 404 },
    );
  }

  try {
    const reservations = await readReservations();
    const slots = buildSlots(
      stationsData.demoDate,
      chargerContext.location,
      chargerContext.charger,
      reservations,
    );

    return NextResponse.json({
      chargerId,
      date: stationsData.demoDate,
      granularityMinutes: GRANULARITY_MINUTES,
      slots,
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo calcular la disponibilidad.", code: "READ_ERROR" },
      { status: 500 },
    );
  }
}
