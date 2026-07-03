// LECTURAS de DB para Server Components (NO "use server": son helpers de
// lectura invocados desde RSC, no acciones de mutación expuestas al cliente).
// server-only por transitividad: importa `db` (cliente libSQL/Turso, server-only).

import { asc, desc, eq, max } from "drizzle-orm";

import {
  db,
  holdingPrices,
  holdings,
  priceUpdates,
  type Holding,
  type HoldingPrice,
  type PriceUpdate,
  type PriceUpdateTrigger,
} from "@/db";
import { holdingPnl, isAlert, portfolioAggregates } from "@/lib/pnl";
import type { PortfolioAggregates } from "@/lib/pnl";

/**
 * Estado del holding respecto al ÚLTIMO `price_updates`:
 *  - 'updated':  obtuvo precio en la última corrida (hay holding_prices).
 *  - 'failed':   ya existía antes de la última corrida pero no obtuvo precio.
 *  - 'pending':  se agregó DESPUÉS de la última corrida (nunca se intentó).
 *  - null:       nunca se ha corrido un "Update prices".
 */
export type LastUpdateStatus = "updated" | "failed" | "pending";

/** Holding + P&L derivado de `lastMarketMxn` y `costBasisMxn`. */
export type HoldingWithPnl = Holding & {
  /** Último valor de mercado en MXN (denormalizado en el holding). */
  marketMxn: number | null;
  /** P&L absoluto en MXN. null para `de_sobre` (solo "valor encontrado"). */
  pnlMxn: number | null;
  /** P&L porcentual. null si no hay costo base > 0 o es `de_sobre`. */
  pnlPct: number | null;
  /** true si el movimiento porcentual alcanza el umbral de alerta. */
  alert: boolean;
  /** Estado respecto a la última actualización de precios. null si nunca corrió. */
  lastUpdateStatus: LastUpdateStatus | null;
  /**
   * Fecha del ÚLTIMO precio registrado para esta carta (max de sus
   * `holding_prices`). null si nunca obtuvo precio. Sirve para verificar de un
   * vistazo si el webhook está refrescando esta carta.
   */
  lastPricedAt: Date | null;
};

/** Resumen del portafolio: agregados + último evento de actualización. */
export type PortfolioSummary = PortfolioAggregates & {
  /** Último `price_updates` (fecha y fxRate del último update). null si nunca. */
  lastUpdate: PriceUpdate | null;
};

/** Punto de la serie temporal de historial (para la gráfica). */
export type HistoryPoint = {
  /** Fecha ISO ('YYYY-MM-DD') del snapshot. */
  date: string;
  /** Timestamp en milisegundos (para ordenar / ejes de tiempo). */
  createdAt: number;
  totalValueMxn: number | null;
  totalCostMxn: number | null;
  totalPnlMxn: number | null;
  totalPnlPct: number | null;
  fxRate: number;
};

/** Todos los holdings, más recientes primero. */
export async function getHoldings(): Promise<Holding[]> {
  return db.select().from(holdings).orderBy(desc(holdings.createdAt)).all();
}

/**
 * Holdings con P&L calculado a partir de `lastMarketMxn` y `costBasisMxn`.
 * Para `de_sobre` el P&L es null (no tiene costo: solo "valor encontrado").
 */
export async function getHoldingsWithPnl(): Promise<HoldingWithPnl[]> {
  const rows = await getHoldings();

  // Último evento de actualización y qué holdings obtuvieron precio en él.
  // Permite marcar visualmente actualizadas vs fallidas (independiente de si
  // la carta tiene un precio viejo de una corrida anterior).
  const lastUpdate =
    (await db
      .select()
      .from(priceUpdates)
      .orderBy(desc(priceUpdates.createdAt))
      .limit(1)
      .get()) ?? null;

  const pricedInLastUpdate = new Set<string>();
  if (lastUpdate) {
    const pricedRows = await db
      .select({ holdingId: holdingPrices.holdingId })
      .from(holdingPrices)
      .where(eq(holdingPrices.updateId, lastUpdate.id))
      .all();
    for (const r of pricedRows) pricedInLastUpdate.add(r.holdingId);
  }

  // Fecha del último precio registrado por carta (max de sus holding_prices).
  // `max()` sobre una columna timestamp devuelve el entero crudo (segundos
  // unixepoch), así que lo convertimos a Date manualmente.
  const lastPricedRows = await db
    .select({
      holdingId: holdingPrices.holdingId,
      lastPricedAt: max(holdingPrices.createdAt),
    })
    .from(holdingPrices)
    .groupBy(holdingPrices.holdingId)
    .all();

  const lastPricedByHolding = new Map<string, Date>();
  for (const r of lastPricedRows) {
    if (r.lastPricedAt == null) continue;
    const secs = Number(r.lastPricedAt);
    if (Number.isFinite(secs)) {
      lastPricedByHolding.set(r.holdingId, new Date(secs * 1000));
    }
  }

  /** Deriva el estado del holding respecto a la última corrida. */
  const statusFor = (h: Holding): LastUpdateStatus | null => {
    if (!lastUpdate) return null; // nunca se corrió un update
    if (pricedInLastUpdate.has(h.id)) return "updated";
    // Si la carta se creó DESPUÉS del último update, no se intentó: pendiente.
    if (h.createdAt > lastUpdate.createdAt) return "pending";
    return "failed";
  };

  return rows.map((h) => {
    const marketMxn = h.lastMarketMxn ?? null;
    const lastUpdateStatus = statusFor(h);
    const lastPricedAt = lastPricedByHolding.get(h.id) ?? null;

    if (h.acquisitionType === "de_sobre") {
      return {
        ...h,
        marketMxn,
        pnlMxn: null,
        pnlPct: null,
        alert: false,
        lastUpdateStatus,
        lastPricedAt,
      };
    }

    const { pnlMxn, pnlPct } = holdingPnl(h.costBasisMxn, marketMxn);
    return {
      ...h,
      marketMxn,
      pnlMxn,
      pnlPct,
      alert: isAlert(pnlPct),
      lastUpdateStatus,
      lastPricedAt,
    };
  });
}

/** Agregados del portafolio + el último `price_updates`. */
export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const rows = await getHoldings();

  const aggregates = portfolioAggregates(
    rows.map((h) => ({
      acquisitionType: h.acquisitionType,
      costBasisMxn: h.costBasisMxn,
      marketMxn: h.lastMarketMxn ?? null,
    })),
  );

  const lastUpdate =
    (await db
      .select()
      .from(priceUpdates)
      .orderBy(desc(priceUpdates.createdAt))
      .limit(1)
      .get()) ?? null;

  return { ...aggregates, lastUpdate };
}

/** Serie de historial (price_updates) ordenada cronológicamente ascendente. */
export async function getHistory(): Promise<HistoryPoint[]> {
  const rows = await db
    .select()
    .from(priceUpdates)
    .orderBy(asc(priceUpdates.createdAt))
    .all();

  return rows.map((u) => {
    const createdAt = u.createdAt.getTime();
    return {
      date: u.createdAt.toISOString().slice(0, 10), // 'YYYY-MM-DD'
      createdAt,
      totalValueMxn: u.totalValueMxn,
      totalCostMxn: u.totalCostMxn,
      totalPnlMxn: u.totalPnlMxn,
      totalPnlPct: u.totalPnlPct,
      fxRate: u.fxRate,
    };
  });
}

/**
 * Una corrida del webhook/actualización de precios, con su desglose de
 * éxitos/fallos para el panel de Webhook.
 */
export type WebhookRun = {
  id: string;
  /** Cuándo ocurrió. */
  createdAt: Date;
  /** Cómo se disparó: 'cron' (webhook diario) o 'manual' (botón). */
  triggerSource: PriceUpdateTrigger;
  /** Cartas que SÍ obtuvieron precio. */
  succeeded: number;
  /** Cartas que fallaron. */
  failed: number;
  /** succeeded + failed (cartas intentadas en la corrida). */
  total: number;
  /** true si se detuvo por el límite diario (429) de la TCG API. */
  rateLimited: boolean;
  /** Tipo de cambio aplicado. */
  fxRate: number;
  /** Valor total de la colección en ese snapshot (MXN). */
  totalValueMxn: number | null;
};

/** Resumen agregado de todas las corridas del webhook. */
export type WebhookSummary = {
  /** Total de corridas registradas. */
  totalRuns: number;
  /** Cuántas corridas tuvieron al menos un fallo. */
  runsWithFailures: number;
  /** Cuántas corridas se cortaron por rate limit (429). */
  rateLimitedRuns: number;
  /** La corrida más reciente (para el estado "¿está vivo el webhook?"). */
  lastRun: WebhookRun | null;
  /** La corrida por cron más reciente (null si el cron nunca ha corrido). */
  lastCronRun: WebhookRun | null;
};

/** Mapea una fila de `price_updates` a `WebhookRun`. */
function toWebhookRun(u: PriceUpdate): WebhookRun {
  const succeeded = u.cardCount ?? 0;
  const failed = u.failedCount ?? 0;
  return {
    id: u.id,
    createdAt: u.createdAt,
    triggerSource: u.triggerSource,
    succeeded,
    failed,
    total: succeeded + failed,
    rateLimited: u.rateLimited,
    fxRate: u.fxRate,
    totalValueMxn: u.totalValueMxn,
  };
}

/** Todas las corridas del webhook, más recientes primero. */
export async function getWebhookRuns(): Promise<WebhookRun[]> {
  const rows = await db
    .select()
    .from(priceUpdates)
    .orderBy(desc(priceUpdates.createdAt))
    .all();
  return rows.map(toWebhookRun);
}

/** Corridas + resumen agregado para el panel de Webhook. */
export async function getWebhookOverview(): Promise<{
  runs: WebhookRun[];
  summary: WebhookSummary;
}> {
  const runs = await getWebhookRuns();

  const summary: WebhookSummary = {
    totalRuns: runs.length,
    runsWithFailures: runs.filter((r) => r.failed > 0).length,
    rateLimitedRuns: runs.filter((r) => r.rateLimited).length,
    lastRun: runs[0] ?? null,
    lastCronRun: runs.find((r) => r.triggerSource === "cron") ?? null,
  };

  return { runs, summary };
}

/** Historial de precios de un holding (drill-down), más antiguos primero. */
export async function getHoldingPriceHistory(
  holdingId: string,
): Promise<HoldingPrice[]> {
  return db
    .select()
    .from(holdingPrices)
    .where(eq(holdingPrices.holdingId, holdingId))
    .orderBy(asc(holdingPrices.createdAt))
    .all();
}
