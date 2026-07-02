"use client";

import * as React from "react";
import {
  ArrowDownUpIcon,
  CircleCheckIcon,
  ImageOffIcon,
  LayersIcon,
  LayoutGridIcon,
  TableIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";
import {
  Card,
  CardAction,
  CardContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { cn } from "@workspace/ui/lib/utils";

import type { HoldingWithPnl } from "@/lib/queries";
import { formatDate, formatMxn } from "@/lib/format";
import { PnlBadge } from "@/components/pnl-badge";

import { HoldingActions } from "./holding-actions";
import { RetryPriceButton } from "./retry-price-button";

type Holding = HoldingWithPnl;

/** Sentinela para "Todos los juegos" (los Select de base-ui no aceptan ""). */
const ALL = "__all__";

/** Sentinela para "sin orden" (mantiene el orden por defecto de la consulta). */
const SORT_NONE = "none";

/** Opciones de ordenamiento del Select, en el orden en que se muestran. */
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: SORT_NONE, label: "Orden por defecto" },
  { value: "value_desc", label: "Valor actual: mayor a menor" },
  { value: "value_asc", label: "Valor actual: menor a mayor" },
  { value: "pnl_desc", label: "P&L: mayor a menor" },
  { value: "pnl_asc", label: "P&L: menor a mayor" },
];

/**
 * Ordena `holdings` según la opción elegida. Los valores nulos (cartas sin
 * precio, o `de_sobre` sin P&L) van SIEMPRE al final, sin importar la dirección.
 * Devuelve el arreglo original cuando la opción es "sin orden".
 */
function sortHoldings(holdings: Holding[], sort: string): Holding[] {
  if (sort === SORT_NONE) return holdings;
  const getValue = sort.startsWith("value")
    ? (h: Holding) => h.marketMxn
    : (h: Holding) => h.pnlMxn;
  const asc = sort.endsWith("asc");
  return [...holdings].sort((a, b) => {
    const av = getValue(a);
    const bv = getValue(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return asc ? av - bv : bv - av;
  });
}

/** Clave estable del juego de una carta (slug → nombre → sentinela "sin juego"). */
function gameKey(h: Holding): string {
  return h.gameSlug ?? h.gameName ?? "__none__";
}

/** Badge del tipo de adquisición (Comprada / De sobre) con estilos distintos. */
function AcquisitionBadge({ type }: { type: Holding["acquisitionType"] }) {
  if (type === "de_sobre") {
    return (
      <Badge
        variant="secondary"
        className="bg-amber-500/15 text-amber-700 dark:text-amber-400"
      >
        De sobre
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="bg-sky-500/15 text-sky-700 dark:text-sky-400"
    >
      Comprada
    </Badge>
  );
}

/**
 * Indicador del estado de la última actualización de precios:
 *  - 'updated' → ✓ verde "Actualizada".
 *  - 'failed'  → ⚠ rojo "No actualizada".
 *  - 'pending' / null → sin marca (carta nueva o nunca se corrió Update prices).
 */
function UpdateStatusBadge({
  status,
  className,
}: {
  status: Holding["lastUpdateStatus"];
  className?: string;
}) {
  if (status === "updated") {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
          className,
        )}
      >
        <CircleCheckIcon className="size-3" />
        Actualizada
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "gap-1 bg-red-500/15 text-red-700 dark:text-red-400",
          className,
        )}
      >
        <TriangleAlertIcon className="size-3" />
        No actualizada
      </Badge>
    );
  }
  return null;
}

/** Etiqueta para cartas de sobre: "valor encontrado", sin P&L. */
function FoundValueBadge() {
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Valor encontrado
    </Badge>
  );
}

/** Renderiza el bloque de P&L según el tipo de carta y disponibilidad de precio. */
function PnlCell({ holding, size }: { holding: Holding; size?: "sm" }) {
  if (holding.marketMxn == null) {
    return (
      <span className="text-xs text-muted-foreground">
        Sin precio — corre Update prices
      </span>
    );
  }
  if (holding.acquisitionType === "de_sobre") {
    return <FoundValueBadge />;
  }
  return (
    <PnlBadge
      pnlPct={holding.pnlPct}
      pnlMxn={holding.pnlMxn}
      size={size ? "sm" : "default"}
    />
  );
}

/** Miniatura de imagen con placeholder cuando no hay `imageUrl`. */
function CardThumb({
  holding,
  className,
}: {
  holding: Holding;
  className?: string;
}) {
  if (!holding.imageUrl) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md bg-muted text-muted-foreground",
          className,
        )}
        aria-hidden="true"
      >
        <ImageOffIcon className="size-4" />
      </div>
    );
  }
  return (
    // Imágenes externas de la API TCG con dominios variables: usamos <img>
    // a propósito (no next/image) para evitar configurar remotePatterns y el
    // coste de optimización; las miniaturas son pequeñas y lazy.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={holding.imageUrl}
      alt={holding.name ?? "Carta"}
      loading="lazy"
      className={cn("rounded-md object-contain", className)}
    />
  );
}

export type HoldingsViewProps = {
  holdings: Holding[];
};

export function HoldingsView({ holdings }: HoldingsViewProps) {
  // Estado del filtro por juego (slug del juego o ALL).
  const [game, setGame] = React.useState<string>(ALL);
  // Estado del ordenamiento (ver SORT_OPTIONS).
  const [sort, setSort] = React.useState<string>(SORT_NONE);

  // Juegos presentes en la colección, deduplicados y ordenados. SOLO se listan
  // los TCG que el usuario realmente tiene agregados (no el catálogo de la API).
  const games = React.useMemo(() => {
    const byKey = new Map<string, string>();
    for (const h of holdings) {
      const key = gameKey(h);
      if (!byKey.has(key)) byKey.set(key, h.gameName ?? "Sin juego");
    }
    return [...byKey.entries()]
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [holdings]);

  // Juego efectivo: si el seleccionado ya no existe (p. ej. tras borrar la
  // última carta de ese juego), se trata como "Todos" sin tocar estado.
  const activeGame =
    game !== ALL && games.some((g) => g.key === game) ? game : ALL;

  const filtered = React.useMemo(
    () =>
      activeGame === ALL
        ? holdings
        : holdings.filter((h) => gameKey(h) === activeGame),
    [holdings, activeGame],
  );

  // Aplica el ordenamiento elegido sobre las cartas ya filtradas por juego.
  // Alimenta tanto la vista Tabla como la Galería.
  const sorted = React.useMemo(
    () => sortHoldings(filtered, sort),
    [filtered, sort],
  );

  return (
    <Tabs defaultValue="table">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="table">
            <TableIcon />
            Tabla
          </TabsTrigger>
          <TabsTrigger value="gallery">
            <LayoutGridIcon />
            Galería
          </TabsTrigger>
        </TabsList>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro por juego: solo se muestra si coleccionas más de un TCG. */}
          {games.length > 1 && (
            <div className="flex items-center gap-2">
              <Select
                value={activeGame}
                onValueChange={(value) => setGame(value as string)}
              >
                <SelectTrigger
                  aria-label="Filtrar por juego"
                  className="min-w-44"
                >
                  <LayersIcon className="text-muted-foreground" />
                  {/* base-ui muestra el `value` crudo por defecto: mapeamos
                      la key del juego a su nombre legible para el trigger. */}
                  <SelectValue>
                    {(value) =>
                      value == null || value === ALL
                        ? "Todos los juegos"
                        : (games.find((g) => g.key === value)?.name ??
                          "Todos los juegos")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los juegos</SelectItem>
                  {games.map((g) => (
                    <SelectItem key={g.key} value={g.key}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeGame !== ALL && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {filtered.length} de {holdings.length}
                </span>
              )}
            </div>
          )}

          {/* Ordenamiento por valor actual o P&L (aplica a Tabla y Galería). */}
          <Select
            value={sort}
            onValueChange={(value) => setSort(value as string)}
          >
            <SelectTrigger aria-label="Ordenar cartas" className="min-w-52">
              <ArrowDownUpIcon className="text-muted-foreground" />
              <SelectValue>
                {(value) =>
                  SORT_OPTIONS.find((o) => o.value === value)?.label ??
                  "Orden por defecto"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Vista Tabla */}
      {/* ---------------------------------------------------------------- */}
      <TabsContent value="table">
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Carta</TableHead>
                <TableHead>Set</TableHead>
                <TableHead>Printing</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">Valor actual</TableHead>
                <TableHead>P&amp;L</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((h) => (
                <TableRow
                  key={h.id}
                  className={cn(
                    h.alert &&
                      "bg-amber-500/[0.04] outline outline-amber-500/30 -outline-offset-1",
                  )}
                >
                  <TableCell>
                    <CardThumb holding={h} className="h-12 w-9" />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {h.name ?? "Sin nombre"}
                      </span>
                      <UpdateStatusBadge status={h.lastUpdateStatus} />
                      {h.lastUpdateStatus === "failed" && (
                        <RetryPriceButton
                          holdingId={h.id}
                          name={h.name}
                          iconOnly
                        />
                      )}
                    </div>
                    {(h.number || h.rarity) && (
                      <div className="text-xs text-muted-foreground">
                        {[h.number ? `#${h.number}` : null, h.rarity]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {h.setName ?? "—"}
                  </TableCell>
                  <TableCell>{h.printing}</TableCell>
                  <TableCell>
                    <AcquisitionBadge type={h.acquisitionType} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {h.acquisitionType === "de_sobre"
                      ? "—"
                      : formatMxn(h.costBasisMxn)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {h.marketMxn == null ? (
                      <span className="text-xs text-muted-foreground">
                        Sin precio
                      </span>
                    ) : (
                      formatMxn(h.marketMxn)
                    )}
                  </TableCell>
                  <TableCell>
                    <PnlCell holding={h} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(h.purchaseDate)}
                  </TableCell>
                  <TableCell>
                    <HoldingActions holding={h} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      {/* ---------------------------------------------------------------- */}
      {/* Vista Galería */}
      {/* ---------------------------------------------------------------- */}
      <TabsContent value="gallery">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {sorted.map((h) => (
            <Card
              key={h.id}
              size="sm"
              className={cn(
                "relative",
                h.alert && "ring-2 ring-amber-500/40",
              )}
            >
              <UpdateStatusBadge
                status={h.lastUpdateStatus}
                className="absolute left-2 top-2 z-10 shadow-sm"
              />
              <CardThumb
                holding={h}
                className="aspect-[5/7] w-full bg-muted"
              />
              <CardHeader>
                <CardTitle
                  className="line-clamp-2 pr-7"
                  title={h.name ?? undefined}
                >
                  {h.name ?? "Sin nombre"}
                </CardTitle>
                <CardAction>
                  <HoldingActions holding={h} size="icon-xs" />
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">
                    {h.printing}
                  </span>
                  <AcquisitionBadge type={h.acquisitionType} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  {h.marketMxn == null ? (
                    <span className="text-xs text-muted-foreground">
                      Sin precio — corre Update prices
                    </span>
                  ) : (
                    <span className="font-medium tabular-nums">
                      {formatMxn(h.marketMxn)}
                    </span>
                  )}
                  <PnlCell holding={h} size="sm" />
                </div>
                {h.lastUpdateStatus === "failed" && (
                  <RetryPriceButton
                    holdingId={h.id}
                    name={h.name}
                    className="w-full"
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}

export default HoldingsView;
