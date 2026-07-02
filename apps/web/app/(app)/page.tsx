// Dashboard / Resumen (raíz, Server Component). Responde de un vistazo
// "¿cuánto invertí y cuánto vale hoy?" (PRD §2, §6).

import Link from "next/link";
import {
  ClockIcon,
  HistoryIcon,
  PackageOpenIcon,
  TriangleAlertIcon,
  WalletCardsIcon,
} from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";

import { SummaryCards } from "@/components/dashboard/summary-cards";
import { formatDateTime } from "@/lib/format";
import { getPortfolioSummary } from "@/lib/queries";

// Lee SQLite en cada request: evita prerender estático y garantiza datos frescos.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const summary = await getPortfolioSummary();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Resumen de tu colección: cuánto invertiste y cuánto vale hoy.
        </p>
      </div>

      {summary.cardCount === 0 ? (
        <EmptyState />
      ) : (
        <>
          <SummaryCards summary={summary} />
          <UpdateContext lastUpdate={summary.lastUpdate} />
          <QuickLinks />
        </>
      )}
    </div>
  );
}

/** Estado vacío: aún no hay cartas. CTA hacia la búsqueda. */
function EmptyState() {
  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <PackageOpenIcon className="size-6" aria-hidden="true" />
        </div>
        <CardTitle className="font-heading text-lg">
          Aún no tienes cartas
        </CardTitle>
        <CardDescription>
          Agrega cartas a tu colección para empezar a seguir su valor y P&amp;L.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button render={<Link href="/search" />}>
          <WalletCardsIcon aria-hidden="true" />
          Buscar cartas
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Contexto del último update de precios.
 * - Si hay snapshot: muestra fecha/hora y tipo de cambio de forma discreta.
 * - Si nunca se corrió: aviso de que los valores de mercado serán 0.
 */
function UpdateContext({
  lastUpdate,
}: {
  lastUpdate: Awaited<ReturnType<typeof getPortfolioSummary>>["lastUpdate"];
}) {
  if (!lastUpdate) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
            <TriangleAlertIcon className="size-4" aria-hidden="true" />
            Aún no has actualizado precios
          </CardTitle>
          <CardDescription>
            Presiona &ldquo;Update prices&rdquo; para obtener el valor de mercado
            de tus cartas. Mientras tanto, los valores de mercado y el ROI se
            muestran en 0.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <ClockIcon className="size-3.5" aria-hidden="true" />
      <span>
        Última actualización:{" "}
        <span className="tabular-nums text-foreground">
          {formatDateTime(lastUpdate.createdAt)}
        </span>
      </span>
      <span aria-hidden="true">·</span>
      <span className="tabular-nums">
        TC: ${lastUpdate.fxRate.toFixed(2)} MXN/USD
      </span>
    </p>
  );
}

/** Accesos rápidos a las demás vistas. */
function QuickLinks() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" render={<Link href="/holdings" />}>
        <WalletCardsIcon aria-hidden="true" />
        Ver mis cartas
      </Button>
      <Button variant="outline" size="sm" render={<Link href="/history" />}>
        <HistoryIcon aria-hidden="true" />
        Ver historial
      </Button>
    </div>
  );
}
