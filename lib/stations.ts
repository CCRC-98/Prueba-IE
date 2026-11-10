import stationsJson from "@/data/stations.json";
import type { ChargerWithContext, StationsData } from "./types";

export const stationsData = stationsJson as StationsData;

export function findChargerById(chargerId: string): ChargerWithContext | null {
  const normalizedId = chargerId.trim();

  for (const location of stationsData.locations) {
    for (const zone of location.zones) {
      const charger = zone.chargers.find((item) => item.id === normalizedId);
      if (charger) {
        return { location, zone, charger };
      }
    }
  }

  return null;
}
