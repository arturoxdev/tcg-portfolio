// LECTURAS de DB para Server Components (NO "use server": son helpers de
// lectura invocados desde RSC, no acciones de mutación expuestas al cliente).
// server-only por transitividad: importa `db` (better-sqlite3, server-only).

import { asc, desc, eq } from "drizzle-orm";

import {
  db,
  holdingPrices,
  holdings,
  priceUpdates,
  type Holding,
  type HoldingPrice,
  type PriceUpdate,
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
    db
      .select()
      .from(priceUpdates)
      .orderBy(desc(priceUpdates.createdAt))
      .limit(1)
      .get() ?? null;

  const pricedInLastUpdate = new Set<string>();
  if (lastUpdate) {
    const pricedRows = db
      .select({ holdingId: holdingPrices.holdingId })
      .from(holdingPrices)
      .where(eq(holdingPrices.updateId, lastUpdate.id))
      .all();
    for (const r of pricedRows) pricedInLastUpdate.add(r.holdingId);
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

    if (h.acquisitionType === "de_sobre") {
      return {
        ...h,
        marketMxn,
        pnlMxn: null,
        pnlPct: null,
        alert: false,
        lastUpdateStatus,
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
    db
      .select()
      .from(priceUpdates)
      .orderBy(desc(priceUpdates.createdAt))
      .limit(1)
      .get() ?? null;

  return { ...aggregates, lastUpdate };
}

/** Serie de historial (price_updates) ordenada cronológicamente ascendente. */
export async function getHistory(): Promise<HistoryPoint[]> {
  const rows = db
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
