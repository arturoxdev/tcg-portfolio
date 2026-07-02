"use server";

// MUTACIONES (Server Actions). server-only por transitividad: importa `db`
// (cliente libSQL/Turso, async) y el cliente TCG (`@/lib/tcg-api`).

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";

import {
  db,
  holdingPrices,
  holdings,
  priceUpdates,
  type AcquisitionType,
} from "@/db";
import { getCardPrices, TcgApiError } from "@/lib/tcg-api";
import { isRateLimited } from "@/lib/api-error";
import type { TcgCardPrice } from "@/lib/tcg-types";
import { marketMxn, snapshotTotals } from "@/lib/pnl";
import type { SnapshotRow, SnapshotTotals } from "@/lib/pnl";
import * as settings from "@/lib/settings";
import { sleep } from "@/lib/throttle";

/** Rutas afectadas por cualquier mutación de holdings / precios. */
const AFFECTED_PATHS = ["/", "/holdings", "/history"] as const;

function revalidateAll(): void {
  for (const p of AFFECTED_PATHS) revalidatePath(p);
}

/**
 * Normaliza `costBasisMxn` según el tipo de adquisición:
 * - 'comprada': debe ser número finito > 0 (Error claro si no).
 * - 'de_sobre': se fuerza a null.
 */
function normalizeCostBasis(
  acquisitionType: AcquisitionType,
  costBasisMxn: number | null | undefined,
): number | null {
  if (acquisitionType === "de_sobre") return null;
  // comprada
  if (
    costBasisMxn == null ||
    typeof costBasisMxn !== "number" ||
    !Number.isFinite(costBasisMxn) ||
    costBasisMxn <= 0
  ) {
    throw new Error(
      "Una carta 'comprada' requiere un costo base (costBasisMxn) numérico mayor que 0.",
    );
  }
  return costBasisMxn;
}

// ---------------------------------------------------------------------------
// addHolding
// ---------------------------------------------------------------------------

/** Datos del diálogo de alta de un holding. */
export type AddHoldingInput = {
  cardId: number;
  tcgplayerId?: number | null;
  printing: string;
  acquisitionType: AcquisitionType;
  costBasisMxn?: number | null;
  /** ISO 'YYYY-MM-DD'. */
  purchaseDate: string;
  notes?: string | null;
  // Metadata cacheada.
  name: string;
  setName?: string | null;
  gameName?: string | null;
  gameSlug?: string | null;
  rarity?: string | null;
  number?: string | null;
  imageUrl?: string | null;
};

/** Inserta un holding nuevo. Devuelve `{ ok, id }` o lanza Error. */
export async function addHolding(
  input: AddHoldingInput,
): Promise<{ ok: true; id: string }> {
  const printing = input.printing?.trim();
  const name = input.name?.trim();

  if (!printing) throw new Error("El campo 'printing' es requerido.");
  if (!name) throw new Error("El campo 'name' es requerido.");

  const costBasisMxn = normalizeCostBasis(
    input.acquisitionType,
    input.costBasisMxn,
  );

  const inserted = await db
    .insert(holdings)
    .values({
      cardId: input.cardId,
      tcgplayerId: input.tcgplayerId ?? null,
      printing,
      acquisitionType: input.acquisitionType,
      costBasisMxn,
      purchaseDate: input.purchaseDate,
      notes: input.notes ?? null,
      name,
      setName: input.setName ?? null,
      gameName: input.gameName ?? null,
      gameSlug: input.gameSlug ?? null,
      rarity: input.rarity ?? null,
      number: input.number ?? null,
      imageUrl: input.imageUrl ?? null,
    })
    .returning({ id: holdings.id })
    .get();

  revalidateAll();
  return { ok: true, id: inserted.id };
}

// ---------------------------------------------------------------------------
// updateHolding
// ---------------------------------------------------------------------------

/** Campos editables de un holding. */
export type UpdateHoldingPatch = {
  printing?: string;
  acquisitionType?: AcquisitionType;
  costBasisMxn?: number | null;
  purchaseDate?: string;
  notes?: string | null;
};

/** Actualiza campos editables de un holding. Devuelve `{ ok }` o lanza Error. */
export async function updateHolding(
  id: string,
  patch: UpdateHoldingPatch,
): Promise<{ ok: true }> {
  if (!id) throw new Error("updateHolding: 'id' es requerido.");

  // Estado actual: necesario para resolver la regla comprada/de_sobre cuando
  // solo se cambia uno de los dos campos (tipo o costo).
  const current = await db
    .select({
      acquisitionType: holdings.acquisitionType,
      costBasisMxn: holdings.costBasisMxn,
    })
    .from(holdings)
    .where(eq(holdings.id, id))
    .get();

  if (!current) throw new Error(`updateHolding: no existe el holding ${id}.`);

  const values: Partial<typeof holdings.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (patch.printing !== undefined) {
    const printing = patch.printing.trim();
    if (!printing) throw new Error("El campo 'printing' no puede estar vacío.");
    values.printing = printing;
  }
  if (patch.purchaseDate !== undefined) values.purchaseDate = patch.purchaseDate;
  if (patch.notes !== undefined) values.notes = patch.notes;

  // Resuelve tipo y costo (sólo si alguno viene en el patch).
  const acquisitionType = patch.acquisitionType ?? current.acquisitionType;
  if (patch.acquisitionType !== undefined) {
    values.acquisitionType = patch.acquisitionType;
  }
  if (patch.acquisitionType !== undefined || patch.costBasisMxn !== undefined) {
    const nextCost =
      patch.costBasisMxn !== undefined
        ? patch.costBasisMxn
        : current.costBasisMxn;
    values.costBasisMxn = normalizeCostBasis(acquisitionType, nextCost);
  }

  await db.update(holdings).set(values).where(eq(holdings.id, id)).run();

  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// deleteHolding
// ---------------------------------------------------------------------------

/** Elimina un holding (cascade borra sus holding_prices). */
export async function deleteHolding(id: string): Promise<{ ok: true }> {
  if (!id) throw new Error("deleteHolding: 'id' es requerido.");
  await db.delete(holdings).where(eq(holdings.id, id)).run();
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Settings: tipo de cambio (FX, MXN por USD)
// ---------------------------------------------------------------------------

/**
 * Guarda el tipo de cambio por defecto (la usa el form de Settings desde el
 * cliente). Revalida las rutas que muestran precios en MXN.
 * Lanza Error si `rate` no es un número > 0.
 */
export async function setFxRate(rate: number): Promise<{ ok: true }> {
  await settings.setFxRate(rate);
  revalidatePath("/settings");
  revalidatePath("/search");
  revalidatePath("/");
  revalidatePath("/holdings");
  return { ok: true };
}

/**
 * Lee el tipo de cambio configurado (null si no hay). Expuesta como action
 * para que el diálogo de "Update prices" (client component) pueda precargarlo
 * sin importar el módulo server-only `@/lib/settings`.
 */
export async function getFxRate(): Promise<number | null> {
  return settings.getFxRate();
}

// ---------------------------------------------------------------------------
// runPriceUpdate
// ---------------------------------------------------------------------------

/** Holding que no pudo actualizarse en un runPriceUpdate. */
export type FailedHolding = {
  holdingId: string;
  name: string;
  reason: string;
};

/** Resultado de `runPriceUpdate`. */
export type RunPriceUpdateResult = {
  ok: true;
  /** id del `price_updates` creado, o null si no había cartas. */
  updateId: string | null;
  /** Número de holdings con precio actualizado. */
  updated: number;
  /** Holdings que fallaron (no abortan el proceso). */
  failed: FailedHolding[];
  /** Totales del snapshot, o null si no había cartas. */
  totals: SnapshotTotals | null;
  /** Tipo de cambio aplicado. */
  fxRate: number;
  /**
   * true si se detuvo el recorrido porque la TCG API devolvió un 429
   * (límite diario account-wide). Default false.
   */
  rateLimited: boolean;
  /** Mensaje informativo (p.ej. cuando no hay cartas). */
  message?: string;
};

/** Precio resuelto en memoria, listo para persistir dentro de la transacción. */
type PricedHolding = {
  holdingId: string;
  marketPriceUsd: number;
  marketPriceMxn: number;
  lowPriceUsd: number | null;
  medianPriceUsd: number | null;
};

const PRICE_UPDATE_DELAY_MS = 350;

/**
 * Normaliza un `printing` a su "familia" para comparar de forma tolerante.
 * La API usa `Normal` / `Foil` / `Holofoil` / `Reverse Holofoil`, etc., y a
 * veces lo que guardamos no coincide carácter a carácter (p. ej. un holding
 * guardado como `Normal` que en realidad es `Foil`). Agrupamos:
 *  - cualquier cosa con "foil" o "holo" → "foil".
 *  - el resto → "normal".
 */
function printingFamily(printing: string): "foil" | "normal" {
  const s = printing.trim().toLowerCase();
  return s.includes("foil") || s.includes("holo") ? "foil" : "normal";
}

/**
 * Selecciona el `TcgCardPrice` que corresponde a un `printing`, tolerante a
 * desajustes de mayúsculas/variantes:
 *  1) match EXACTO por campo `printing`.
 *  2) match case-insensitive.
 *  3) match por familia (foil ≈ holofoil) cuando es inequívoco (1 candidato).
 *  4) si sólo hay una variante, se usa esa.
 *  5) en otro caso, null (se registra como fallo aguas arriba).
 */
function pickPriceForPrinting(
  prices: TcgCardPrice[],
  printing: string,
): TcgCardPrice | null {
  if (prices.length === 0) return null;

  const exact = prices.find((p) => p.printing === printing);
  if (exact) return exact;

  const lower = printing.toLowerCase();
  const ci = prices.find((p) => p.printing.toLowerCase() === lower);
  if (ci) return ci;

  const target = printingFamily(printing);
  const sameFamily = prices.filter((p) => printingFamily(p.printing) === target);
  if (sameFamily.length === 1) return sameFamily[0] ?? null;

  if (prices.length === 1) return prices[0] ?? null;
  return null;
}

/**
 * CORE: actualiza precios de todos los holdings y crea un snapshot.
 *
 * Estrategia:
 *  - Fase de fetch (fuera de transacción): fetch SECUENCIAL con throttle,
 *    acumulando éxitos/fallos en memoria. Resiliente: un fallo NO aborta.
 *  - Fase de persistencia (dentro de `db.transaction` async de libSQL):
 *    inserta price_updates + holding_prices y actualiza holdings.lastMarketMxn.
 *    Con libSQL cada sentencia es un round-trip; a nuestra escala es trivial.
 */
export async function runPriceUpdate(
  fxRate?: number,
): Promise<RunPriceUpdateResult> {
  // Resuelve el FX: usa el argumento si viene; si no, el configurado en Settings.
  const resolvedFxRate =
    fxRate != null ? fxRate : await settings.getFxRate();

  if (
    resolvedFxRate == null ||
    typeof resolvedFxRate !== "number" ||
    !Number.isFinite(resolvedFxRate) ||
    resolvedFxRate <= 0
  ) {
    throw new Error(
      "Configura el tipo de cambio en Settings antes de actualizar precios.",
    );
  }

  const allHoldings = await db.select().from(holdings).all();

  if (allHoldings.length === 0) {
    return {
      ok: true,
      updated: 0,
      failed: [],
      updateId: null,
      totals: null,
      fxRate: resolvedFxRate,
      rateLimited: false,
      message: "Sin cartas",
    };
  }

  // --- Fase async: fetch secuencial con throttle, acumulando en memoria. ---
  const priced: PricedHolding[] = [];
  const failed: FailedHolding[] = [];
  const pricedByHolding = new Map<string, PricedHolding>();
  let rateLimited = false;

  for (let i = 0; i < allHoldings.length; i++) {
    if (i > 0) await sleep(PRICE_UPDATE_DELAY_MS);
    const h = allHoldings[i]!;
    const name = h.name ?? h.id;

    // [runPriceUpdate] Log por cada "siguiente" carta del recorrido.
    console.log(
      `[runPriceUpdate] (${i + 1}/${allHoldings.length}) "${name}" ` +
        `cardId=${h.cardId} printing="${h.printing}"`,
    );

    if (h.cardId == null) {
      console.log(`[runPriceUpdate]   ✗ sin cardId asociado → omitida`);
      failed.push({
        holdingId: h.id,
        name,
        reason: "El holding no tiene cardId asociado.",
      });
      continue;
    }

    try {
      const prices = await getCardPrices(h.cardId);
      const match = pickPriceForPrinting(prices, h.printing);

      console.log(
        `[runPriceUpdate]   variantes=${prices.length} ` +
          `[${prices.map((p) => p.printing).join(", ")}] ` +
          `match=${match ? `"${match.printing}" market_price=${match.market_price}` : "null"}`,
      );

      if (!match || match.market_price == null) {
        const reason = !match
          ? `Sin variante que coincida con printing '${h.printing}'.`
          : "La variante no tiene market_price.";
        console.log(`[runPriceUpdate]   ✗ ${reason}`);
        failed.push({
          holdingId: h.id,
          name,
          reason,
        });
        continue;
      }

      const usd = match.market_price;
      const entry: PricedHolding = {
        holdingId: h.id,
        marketPriceUsd: usd,
        marketPriceMxn: marketMxn(usd, resolvedFxRate),
        lowPriceUsd: match.low_price ?? null,
        medianPriceUsd: match.median_price ?? null,
      };
      priced.push(entry);
      pricedByHolding.set(h.id, entry);
      console.log(
        `[runPriceUpdate]   ✓ actualizada: ${usd} USD → ${entry.marketPriceMxn} MXN`,
      );
    } catch (err) {
      // 429 = límite diario account-wide: no tiene sentido seguir gastando
      // cuota. Marcamos la bandera, registramos el holding que lo disparó y
      // DETENEMOS el recorrido (los éxitos previos se conservan).
      const status = err instanceof TcgApiError ? err.status : undefined;
      if (
        status === 429 ||
        (err instanceof TcgApiError && isRateLimited(err.status, err.body))
      ) {
        console.log(
          `[runPriceUpdate]   ✗ 429: límite diario de la TCG API alcanzado → se detiene el recorrido`,
        );
        rateLimited = true;
        failed.push({
          holdingId: h.id,
          name,
          reason: "Límite diario de la TCG API alcanzado (429).",
        });
        break;
      }

      const reason =
        err instanceof Error ? err.message : "Error desconocido al consultar precios.";
      console.log(
        `[runPriceUpdate]   ✗ error al consultar precios (status=${status ?? "n/a"}): ${reason}`,
      );
      failed.push({ holdingId: h.id, name, reason });
    }
  }

  console.log(
    `[runPriceUpdate] Fin del recorrido: ${priced.length} actualizadas, ` +
      `${failed.length} fallidas${rateLimited ? " (detenido por 429)" : ""}.`,
  );
  if (failed.length > 0) {
    console.log(
      `[runPriceUpdate] Fallidas:`,
      failed.map((f) => `${f.name}: ${f.reason}`),
    );
  }

  // Si se alcanzó el límite sin ningún éxito previo, no creamos un snapshot
  // vacío: devolvemos directo informando del rate limit.
  if (rateLimited && priced.length === 0) {
    revalidateAll();
    return {
      ok: true,
      updateId: null,
      updated: 0,
      failed,
      totals: null,
      fxRate: resolvedFxRate,
      rateLimited: true,
      message: "Límite de la API alcanzado",
    };
  }

  // --- Totales del snapshot: TODOS los holdings (hasPrice=false los fallidos). ---
  const snapshotRows: SnapshotRow[] = allHoldings.map((h) => {
    const p = pricedByHolding.get(h.id);
    return {
      acquisitionType: h.acquisitionType,
      costBasisMxn: h.costBasisMxn,
      marketMxn: p ? p.marketPriceMxn : null,
      hasPrice: p != null,
    };
  });
  const totals = snapshotTotals(snapshotRows);

  // --- Fase de persistencia: transacción async de libSQL. ---
  const updatedAt = new Date();
  const updateId = await db.transaction(async (tx) => {
    const update = await tx
      .insert(priceUpdates)
      .values({
        fxRate: resolvedFxRate,
        totalCostMxn: totals.total_cost_mxn,
        totalValueMxn: totals.total_value_mxn,
        totalPnlMxn: totals.total_pnl_mxn,
        totalPnlPct: totals.total_pnl_pct,
        cardCount: totals.card_count,
      })
      .returning({ id: priceUpdates.id })
      .get();

    for (const p of priced) {
      await tx
        .insert(holdingPrices)
        .values({
          updateId: update.id,
          holdingId: p.holdingId,
          marketPriceUsd: p.marketPriceUsd,
          marketPriceMxn: p.marketPriceMxn,
          lowPriceUsd: p.lowPriceUsd,
          medianPriceUsd: p.medianPriceUsd,
        })
        .run();

      await tx
        .update(holdings)
        .set({ lastMarketMxn: p.marketPriceMxn, updatedAt })
        .where(eq(holdings.id, p.holdingId))
        .run();
    }

    return update.id;
  });

  revalidateAll();

  return {
    ok: true,
    updateId,
    updated: priced.length,
    failed,
    totals,
    fxRate: resolvedFxRate,
    rateLimited,
  };
}

// ---------------------------------------------------------------------------
// retryHoldingPrice
// ---------------------------------------------------------------------------

/** Resultado de `retryHoldingPrice`. */
export type RetryHoldingPriceResult =
  | {
      ok: true;
      updated: true;
      holdingId: string;
      name: string;
      marketPriceUsd: number;
      marketPriceMxn: number;
    }
  | {
      ok: true;
      updated: false;
      holdingId: string;
      name: string;
      reason: string;
      /** true si falló por el límite diario (429) de la TCG API. */
      rateLimited: boolean;
    };

/**
 * Reintenta la actualización de precio de UN holding (botón "Reintentar" de las
 * cartas marcadas "No actualizada").
 *
 * Adjunta el precio al ÚLTIMO `price_updates` existente (en vez de crear un
 * snapshot nuevo de una sola carta): inserta su `holding_prices`, actualiza
 * `holdings.lastMarketMxn` y RECALCULA los totales de ese snapshot para que el
 * historial siga cuadrando. Así la carta pasa de "No actualizada" a
 * "Actualizada" en ese mismo update. Usa el `fxRate` del snapshot.
 */
export async function retryHoldingPrice(
  holdingId: string,
): Promise<RetryHoldingPriceResult> {
  if (!holdingId) throw new Error("retryHoldingPrice: 'holdingId' es requerido.");

  const h = await db
    .select()
    .from(holdings)
    .where(eq(holdings.id, holdingId))
    .get();
  if (!h) throw new Error(`retryHoldingPrice: no existe el holding ${holdingId}.`);
  const name = h.name ?? h.id;

  const lastUpdate =
    (await db
      .select()
      .from(priceUpdates)
      .orderBy(desc(priceUpdates.createdAt))
      .limit(1)
      .get()) ?? null;

  if (!lastUpdate) {
    return {
      ok: true,
      updated: false,
      holdingId,
      name,
      reason: "Aún no hay un snapshot de precios. Corre 'Update prices' primero.",
      rateLimited: false,
    };
  }

  if (h.cardId == null) {
    return {
      ok: true,
      updated: false,
      holdingId,
      name,
      reason: "El holding no tiene cardId asociado.",
      rateLimited: false,
    };
  }

  // FX del snapshot: mantiene la coherencia con las demás cartas de ese update.
  const fxRate = lastUpdate.fxRate;

  let usd: number;
  let mxn: number;
  let lowUsd: number | null;
  let medianUsd: number | null;
  try {
    const prices = await getCardPrices(h.cardId);
    const match = pickPriceForPrinting(prices, h.printing);

    if (!match || match.market_price == null) {
      const reason = !match
        ? `Sin variante que coincida con printing '${h.printing}'.`
        : "La variante no tiene market_price.";
      console.log(`[retryHoldingPrice] ✗ "${name}": ${reason}`);
      return { ok: true, updated: false, holdingId, name, reason, rateLimited: false };
    }

    usd = match.market_price;
    mxn = marketMxn(usd, fxRate);
    lowUsd = match.low_price ?? null;
    medianUsd = match.median_price ?? null;
  } catch (err) {
    const status = err instanceof TcgApiError ? err.status : undefined;
    const rl =
      status === 429 ||
      (err instanceof TcgApiError && isRateLimited(err.status, err.body));
    const reason = rl
      ? "Límite diario de la TCG API alcanzado (429)."
      : err instanceof Error
        ? err.message
        : "Error desconocido al consultar precios.";
    console.log(
      `[retryHoldingPrice] ✗ "${name}" (status=${status ?? "n/a"}): ${reason}`,
    );
    return { ok: true, updated: false, holdingId, name, reason, rateLimited: Boolean(rl) };
  }

  const updatedAt = new Date();
  await db.transaction(async (tx) => {
    // Idempotencia: si ya hubiera una fila para este par (no debería, porque
    // falló), la reemplazamos.
    await tx
      .delete(holdingPrices)
      .where(
        and(
          eq(holdingPrices.updateId, lastUpdate.id),
          eq(holdingPrices.holdingId, holdingId),
        ),
      )
      .run();

    await tx
      .insert(holdingPrices)
      .values({
        updateId: lastUpdate.id,
        holdingId,
        marketPriceUsd: usd,
        marketPriceMxn: mxn,
        lowPriceUsd: lowUsd,
        medianPriceUsd: medianUsd,
      })
      .run();

    await tx
      .update(holdings)
      .set({ lastMarketMxn: mxn, updatedAt })
      .where(eq(holdings.id, holdingId))
      .run();

    // Recalcula los totales del snapshot con el precio que cada holding tiene
    // EN este update (los que siguen fallidos cuentan como sin precio).
    const allHoldings = await tx.select().from(holdings).all();
    const pricedRows = await tx
      .select({
        holdingId: holdingPrices.holdingId,
        marketPriceMxn: holdingPrices.marketPriceMxn,
      })
      .from(holdingPrices)
      .where(eq(holdingPrices.updateId, lastUpdate.id))
      .all();
    const priceByHolding = new Map(
      pricedRows.map((r) => [r.holdingId, r.marketPriceMxn]),
    );

    const snapshotRows: SnapshotRow[] = allHoldings.map((hh) => {
      const m = priceByHolding.get(hh.id) ?? null;
      return {
        acquisitionType: hh.acquisitionType,
        costBasisMxn: hh.costBasisMxn,
        marketMxn: m,
        hasPrice: m != null,
      };
    });
    const totals = snapshotTotals(snapshotRows);

    await tx
      .update(priceUpdates)
      .set({
        totalCostMxn: totals.total_cost_mxn,
        totalValueMxn: totals.total_value_mxn,
        totalPnlMxn: totals.total_pnl_mxn,
        totalPnlPct: totals.total_pnl_pct,
        cardCount: totals.card_count,
      })
      .where(eq(priceUpdates.id, lastUpdate.id))
      .run();
  });

  console.log(`[retryHoldingPrice] ✓ "${name}": ${usd} USD → ${mxn} MXN`);
  revalidateAll();

  return {
    ok: true,
    updated: true,
    holdingId,
    name,
    marketPriceUsd: usd,
    marketPriceMxn: mxn,
  };
}
