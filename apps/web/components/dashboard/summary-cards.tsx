// Server Component (solo render, sin estado ni interactividad): renderiza las
// tarjetas de resumen del portafolio a partir de los agregados ya calculados en
// `getPortfolioSummary`.
//
// Se divide en DOS secciones independientes porque juntar las métricas mezcla
// dos cosas que no son comparables:
//   1. Cartas COMPRADAS → análisis completo (capital, valor de mercado, ROI/P&L).
//   2. Cartas DE SOBRE   → cuenta básica (cuántas hay y cuánto valen); no tienen
//      costo, así que no participan en ROI ni en capital invertido.

import {
  CoinsIcon,
  LayersIcon,
  PackageOpenIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";

import { PnlBadge } from "@/components/pnl-badge";
import { formatMxn, formatPct } from "@/lib/format";
import type { PortfolioSummary } from "@/lib/queries";

export type SummaryCardsProps = {
  summary: PortfolioSummary;
};

const VALUE_CLASS = "text-2xl font-semibold tabular-nums";

/** Título de sección con conteo de lotes a la derecha. */
function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      <span className="text-xs text-muted-foreground tabular-nums">
        {count.toLocaleString("es-MX")} {count === 1 ? "lote" : "lotes"}
      </span>
    </div>
  );
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const {
    capitalInvertido,
    valorCompradas,
    roiPct,
    valorEncontrado,
    pnlComprodasMxn,
    boughtCount,
    foundCount,
  } = summary;

  return (
    <div className="flex flex-col gap-8">
      {/* ============================================================== */}
      {/* Sección 1 — Cartas compradas (análisis completo)              */}
      {/* ============================================================== */}
      <section className="flex flex-col gap-3">
        <SectionHeading title="Cartas compradas" count={boughtCount} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Capital invertido = Σ costo de cartas compradas. */}
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                <WalletIcon className="size-4" aria-hidden="true" />
                Capital invertido
              </CardDescription>
              <CardTitle className={VALUE_CLASS}>
                {formatMxn(capitalInvertido)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                lo que pagaste por ellas
              </p>
            </CardContent>
          </Card>

          {/* Valor de mercado (esperado) de las compradas + badge de P&L. */}
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                <CoinsIcon className="size-4" aria-hidden="true" />
                Valor de mercado
              </CardDescription>
              <CardTitle className={VALUE_CLASS}>
                {formatMxn(valorCompradas)}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              <PnlBadge pnlPct={roiPct} pnlMxn={pnlComprodasMxn} />
              <p className="text-xs text-muted-foreground">
                valor esperado hoy
              </p>
            </CardContent>
          </Card>

          {/* ROI: % grande + badge. P&L no realizado de las compradas. */}
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                <TrendingUpIcon className="size-4" aria-hidden="true" />
                ROI
              </CardDescription>
              <CardTitle className={VALUE_CLASS}>{formatPct(roiPct)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              <PnlBadge pnlPct={roiPct} pnlMxn={pnlComprodasMxn} />
              <p className="text-xs text-muted-foreground">
                ganancia/pérdida no realizada
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ============================================================== */}
      {/* Sección 2 — Cartas de sobre (cuenta básica)                   */}
      {/* ============================================================== */}
      <section className="flex flex-col gap-3">
        <SectionHeading title="Cartas de sobre" count={foundCount} />
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Cuántas cartas de sobre tengo hoy. */}
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                <LayersIcon className="size-4" aria-hidden="true" />
                Cartas
              </CardDescription>
              <CardTitle className={VALUE_CLASS}>
                {foundCount.toLocaleString("es-MX")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                lotes que te salieron de sobre
              </p>
            </CardContent>
          </Card>

          {/* Cuánto valen (valor de mercado; no cuentan al ROI ni al capital). */}
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                <PackageOpenIcon className="size-4" aria-hidden="true" />
                Valor encontrado
              </CardDescription>
              <CardTitle className={VALUE_CLASS}>
                {formatMxn(valorEncontrado)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                valor de mercado hoy
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

export default SummaryCards;
