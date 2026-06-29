// Server Component (solo render, sin estado ni interactividad): renderiza la
// cuadrícula de tarjetas de resumen del portafolio a partir de los agregados
// ya calculados en `getPortfolioSummary`.

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

export function SummaryCards({ summary }: SummaryCardsProps) {
  const {
    capitalInvertido,
    valorCompradas,
    roiPct,
    valorEncontrado,
    valorColeccion,
    pnlComprodasMxn,
    cardCount,
  } = summary;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Capital invertido = Σ costo de cartas compradas. */}
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
          <p className="text-xs text-muted-foreground">en cartas compradas</p>
        </CardContent>
      </Card>

      {/* 2. Valor de mercado (compradas) + badge de ROI/P&L. */}
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
          <p className="text-xs text-muted-foreground">de cartas compradas</p>
        </CardContent>
      </Card>

      {/* 3. ROI: % grande + badge. P&L no realizado de las compradas. */}
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

      {/* 4. Valor encontrado = valor de mercado de cartas "de sobre". */}
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
            cartas de sobre (no cuentan al ROI)
          </p>
        </CardContent>
      </Card>

      {/* 5. Valor total de la colección (destacada/ancha): compradas + de sobre. */}
      <Card className="bg-muted/40 sm:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <LayersIcon className="size-4" aria-hidden="true" />
            Valor total de la colección
          </CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            {formatMxn(valorColeccion)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">compradas + de sobre</p>
        </CardContent>
      </Card>

      {/* 6. Cartas: total de lotes en la colección. */}
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <LayersIcon className="size-4" aria-hidden="true" />
            Cartas
          </CardDescription>
          <CardTitle className={VALUE_CLASS}>
            {cardCount.toLocaleString("es-MX")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">lotes en la colección</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default SummaryCards;
