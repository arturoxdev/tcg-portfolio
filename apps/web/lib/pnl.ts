// Lógica de negocio PURA de P&L (sin I/O, sin DB, sin fetch).
// Todos los montos en MXN salvo donde se indique USD.

/** Tipo de adquisición de una carta. */
export type AcquisitionType = "comprada" | "de_sobre";

/**
 * Convierte un precio de mercado en USD a MXN.
 * @param marketPriceUsd precio de mercado en USD
 * @param fxRate tipo de cambio USD→MXN
 */
export function marketMxn(marketPriceUsd: number, fxRate: number): number {
  return marketPriceUsd * fxRate;
}

/**
 * P&L de una posición individual.
 * pnlMxn = market - cost
 * pnlPct = (pnlMxn / cost) * 100
 *
 * DECISIÓN: si `costBasisMxn` no es > 0 (0, null, NaN), devolvemos pnlPct = null
 * para evitar división por cero / porcentajes sin sentido. pnlMxn sí se calcula.
 */
export function holdingPnl(
  costBasisMxn: number | null,
  marketMxn: number | null,
): { pnlMxn: number; pnlPct: number | null } {
  const cost = costBasisMxn ?? 0;
  const market = marketMxn ?? 0;
  const pnlMxn = market - cost;
  const pnlPct = cost > 0 ? (pnlMxn / cost) * 100 : null;
  return { pnlMxn, pnlPct };
}

/**
 * Indica si una posición debe marcarse como alerta por movimiento de precio.
 * Es alerta cuando hay porcentaje y su valor absoluto alcanza el umbral.
 */
export function isAlert(pnlPct: number | null, threshold = 10): boolean {
  return pnlPct != null && Math.abs(pnlPct) >= threshold;
}

/** Fila mínima para agregados de portafolio. */
export interface PortfolioRow {
  acquisitionType: AcquisitionType;
  costBasisMxn: number | null;
  marketMxn: number | null;
}

/** Agregados del portafolio completo. */
export interface PortfolioAggregates {
  capitalInvertido: number;
  valorCompradas: number;
  roiPct: number | null;
  valorEncontrado: number;
  valorColeccion: number;
  pnlComprodasMxn: number;
  cardCount: number;
  /** Número de lotes 'comprada'. */
  boughtCount: number;
  /** Número de lotes 'de_sobre'. */
  foundCount: number;
}

/**
 * Agregados del portafolio.
 *
 * DECISIÓN: las cartas sin precio aún (marketMxn null) se tratan como 0 en
 * todas las sumas de valor de mercado.
 *
 * - capitalInvertido = Σ costBasisMxn de las 'comprada'
 * - valorCompradas    = Σ marketMxn de las 'comprada'
 * - roiPct            = capitalInvertido>0 ? (valorCompradas - capitalInvertido)/capitalInvertido*100 : null
 * - valorEncontrado   = Σ marketMxn de las 'de_sobre' ("valor encontrado")
 * - valorColeccion    = valorCompradas + valorEncontrado
 * - pnlComprodasMxn   = valorCompradas - capitalInvertido
 * - cardCount         = total de filas
 */
export function portfolioAggregates(rows: PortfolioRow[]): PortfolioAggregates {
  let capitalInvertido = 0;
  let valorCompradas = 0;
  let valorEncontrado = 0;
  let boughtCount = 0;
  let foundCount = 0;

  for (const row of rows) {
    const market = row.marketMxn ?? 0; // sin precio aún → 0
    if (row.acquisitionType === "comprada") {
      capitalInvertido += row.costBasisMxn ?? 0;
      valorCompradas += market;
      boughtCount += 1;
    } else {
      valorEncontrado += market;
      foundCount += 1;
    }
  }

  const valorColeccion = valorCompradas + valorEncontrado;
  const pnlComprodasMxn = valorCompradas - capitalInvertido;
  const roiPct =
    capitalInvertido > 0 ? (pnlComprodasMxn / capitalInvertido) * 100 : null;

  return {
    capitalInvertido,
    valorCompradas,
    roiPct,
    valorEncontrado,
    valorColeccion,
    pnlComprodasMxn,
    cardCount: rows.length,
    boughtCount,
    foundCount,
  };
}

/** Fila con precio para construir un snapshot de price_updates. */
export interface SnapshotRow extends PortfolioRow {
  /** true si la fila tiene precio de mercado (cuenta para card_count del snapshot). */
  hasPrice: boolean;
}

/** Totales de un snapshot de price_updates. */
export interface SnapshotTotals {
  total_cost_mxn: number;
  total_value_mxn: number;
  total_pnl_mxn: number;
  total_pnl_pct: number | null;
  card_count: number;
}

/**
 * Construye los totales de un snapshot `price_updates` a partir de las filas.
 *
 * DECISIONES:
 * - total_value_mxn = valor de la colección COMPLETA (compradas + de sobre).
 *   La gráfica de historial usa este campo como "valor del portafolio".
 * - total_cost_mxn  = capitalInvertido (solo compradas).
 * - total_pnl_mxn / total_pnl_pct = sobre las compradas (ROI), no sobre la colección.
 * - card_count = número de filas que tienen precio (hasPrice === true).
 */
export function snapshotTotals(rows: SnapshotRow[]): SnapshotTotals {
  const agg = portfolioAggregates(rows);
  const cardCountWithPrice = rows.reduce(
    (acc, row) => acc + (row.hasPrice ? 1 : 0),
    0,
  );

  return {
    total_cost_mxn: agg.capitalInvertido,
    total_value_mxn: agg.valorColeccion, // colección completa (compradas + de sobre)
    total_pnl_mxn: agg.pnlComprodasMxn, // ROI: solo compradas
    total_pnl_pct: agg.roiPct, // ROI: solo compradas
    card_count: cardCountWithPrice,
  };
}
