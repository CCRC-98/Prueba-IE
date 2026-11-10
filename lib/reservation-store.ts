import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Reservation } from "./types";

export type { Reservation };

const reservationsFile = path.join(process.cwd(), "data", "reservations.json");

export async function readReservations(): Promise<Reservation[]> {
  try {
    const contents = await readFile(reservationsFile, "utf8");
    const parsed = JSON.parse(contents) as unknown;
    return Array.isArray(parsed) ? (parsed as Reservation[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function writeReservations(reservations: Reservation[]) {
  const contents = `${JSON.stringify(reservations, null, 2)}\n`;
  const temporaryFile = `${reservationsFile}.${process.pid}.tmp`;

  // Escritura atómica: un GET concurrente nunca ve un JSON a medio escribir.
  await writeFile(temporaryFile, contents, "utf8");
  await rename(temporaryFile, reservationsFile);
}

// Serializa las escrituras dentro de este proceso. No sustituye una
// transacción de base de datos, pero evita perder reservas en el ejercicio.
let writeQueue: Promise<unknown> = Promise.resolve();

export function withReservationsLock<T>(task: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(task, task);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
