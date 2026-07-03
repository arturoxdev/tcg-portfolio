// Server Component (solo render, sin estado): panel de resumen del "webhook"
// (el cron diario que dispara /api/cron/update-prices) + el botón manual.
//
// Cada fila de `price_updates` es una corrida. Mostramos, por corrida: cómo se
// disparó (cron/manual), cuántas cartas se actualizaron (éxitos), cuántas
// fallaron y si se cortó por el límite diario (429) de la TCG API.

import {
  ActivityIcon,
  CircleCheckIcon,
  ClockIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { cn } from "@workspace/ui/lib/utils";

import type { WebhookRun, WebhookSummary } from "@/lib/queries";
import { formatDateTime, formatMxn } from "@/lib/format";

const VALUE_CLASS = "text-2xl font-semibold tabular-nums";

/** Badge de cómo se disparó la corrida. */
function TriggerBadge({ trigger }: { trigger: WebhookRun["triggerSource"] }) {
  if (trigger === "cron") {
    return (
      <Badge
        variant="secondary"
        className="gap-1 bg-violet-500/15 text-violet-700 dark:text-violet-400"
      >
        <ClockIcon className="size-3" />
        Cron
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="gap-1 bg-sky-500/15 text-sky-700 dark:text-sky-400"
    >
      <ActivityIcon className="size-3" />
      Manual
    </Badge>
  );
}

/** Badge de estado (OK / con fallos / rate limit) de una corrida. */
function RunStatusBadge({ run }: { run: WebhookRun }) {
  if (run.rateLimited) {
    return (
      <Badge
        variant="secondary"
        className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400"
      >
        <TriangleAlertIcon className="size-3" />
        Límite 429
      </Badge>
    );
  }
  if (run.failed > 0) {
    return (
      <Badge
        variant="secondary"
        className="gap-1 bg-red-500/15 text-red-700 dark:text-red-400"
      >
        <TriangleAlertIcon className="size-3" />
        Con fallos
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
    >
      <CircleCheckIcon className="size-3" />
      OK
    </Badge>
  );
}

export type WebhookViewProps = {
  runs: WebhookRun[];
  summary: WebhookSummary;
};

export function WebhookView({ runs, summary }: WebhookViewProps) {
  const { lastRun, lastCronRun, totalRuns, runsWithFailures } = summary;

  return (
    <div className="flex flex-col gap-6">
      {/* Tarjetas de resumen. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Última corrida (¿está vivo el webhook?). */}
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <ClockIcon className="size-4" aria-hidden="true" />
              Última corrida
            </CardDescription>
            <CardTitle className="text-lg font-semibold tabular-nums">
              {lastRun ? formatDateTime(lastRun.createdAt) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-1.5">
            {lastRun ? (
              <>
                <TriggerBadge trigger={lastRun.triggerSource} />
                <RunStatusBadge run={lastRun} />
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Aún no hay corridas.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Último cron (para verificar que el webhook diario dispara). */}
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <ActivityIcon className="size-4" aria-hidden="true" />
              Último cron
            </CardDescription>
            <CardTitle className="text-lg font-semibold tabular-nums">
              {lastCronRun ? formatDateTime(lastCronRun.createdAt) : "Nunca"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {lastCronRun
                ? `${lastCronRun.succeeded} ok · ${lastCronRun.failed} fallidas`
                : "El cron de Vercel aún no ha corrido."}
            </p>
          </CardContent>
        </Card>

        {/* Total de corridas. */}
        <Card>
          <CardHeader>
            <CardDescription>Total de corridas</CardDescription>
            <CardTitle className={VALUE_CLASS}>
              {totalRuns.toLocaleString("es-MX")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              snapshots de precios registrados
            </p>
          </CardContent>
        </Card>

        {/* Corridas con fallos. */}
        <Card
          className={cn(
            runsWithFailures > 0 && "ring-1 ring-red-500/30",
          )}
        >
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <TriangleAlertIcon className="size-4" aria-hidden="true" />
              Con fallos
            </CardDescription>
            <CardTitle className={VALUE_CLASS}>
              {runsWithFailures.toLocaleString("es-MX")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              corridas donde ≥1 carta falló
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de corridas. */}
      {runs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aún no hay corridas del webhook. Se registrarán cuando corra el cron
          diario o presiones &quot;Update prices&quot;.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y hora</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Exitosas</TableHead>
                <TableHead className="text-right">Fallidas</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Valor colección</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow
                  key={run.id}
                  className={cn(
                    run.failed > 0 &&
                      "bg-red-500/[0.03] outline outline-red-500/20 -outline-offset-1",
                  )}
                >
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatDateTime(run.createdAt)}
                  </TableCell>
                  <TableCell>
                    <TriggerBadge trigger={run.triggerSource} />
                  </TableCell>
                  <TableCell>
                    <RunStatusBadge run={run} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {run.succeeded}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      run.failed > 0
                        ? "font-medium text-red-600 dark:text-red-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {run.failed}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {run.total}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMxn(run.totalValueMxn)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default WebhookView;
