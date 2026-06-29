// SERVER ONLY — nunca importar desde componentes cliente.
// Lecturas/escrituras de configuración persistente (tabla key-value `settings`).
// server-only por transitividad: importa `db` (better-sqlite3, server-only).
// NO lleva "use server": son funciones planas consumidas por Server Components
// y por las server actions de `@/lib/actions`.

import { eq } from "drizzle-orm";

import { db, settings } from "@/db";

/** Clave del tipo de cambio (MXN por USD) en la tabla `settings`. */
export const FX_RATE_KEY = "fx_rate";

/** Lee el valor de una clave. Devuelve null si no existe. */
export async function getSetting(key: string): Promise<string | null> {
  const row = db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .get();
  return row?.value ?? null;
}

/** UPSERT de una clave: inserta o actualiza el valor y `updatedAt`. */
export async function setSetting(key: string, value: string): Promise<void> {
  db.insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
    })
    .run();
}

/**
 * Tipo de cambio (MXN por USD) configurado.
 * Devuelve null si no existe, o no es un número finito > 0.
 */
export async function getFxRate(): Promise<number | null> {
  const raw = await getSetting(FX_RATE_KEY);
  if (raw == null) return null;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

/** Guarda el tipo de cambio. Lanza Error si no es un número finito > 0. */
export async function setFxRate(rate: number): Promise<void> {
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("El tipo de cambio (FX) debe ser un número mayor que 0.");
  }
  await setSetting(FX_RATE_KEY, String(rate));
}
