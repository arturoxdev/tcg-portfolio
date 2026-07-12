"use client";

import * as React from "react";
import {
  ArrowDownUpIcon,
  CircleCheckIcon,
  EyeIcon,
  ImageOffIcon,
  LayersIcon,
  LayoutGridIcon,
  PlusIcon,
  TableIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
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
import { formatDate, formatDateTime, formatMxn } from "@/lib/format";
import { PnlBadge } from "@/components/pnl-badge";

import { AddPurchaseDialog } from "./add-purchase-dialog";
import { HoldingActions } from "./holding-actions";
import { RetryPriceButton } from "./retry-price-button";

type Holding = HoldingWithPnl;

type GroupUpdateStatus = Holding["lastUpdateStatus"] | "partial";

type HoldingGroup = {
  key: string;
  holding: Holding;
  lots: Holding[];
  quantity: number;
  boughtCount: number;
  averageCostMxn: number | null;
  marketMxn: number | null;
  pnlMxn: number | null;
  pnlPct: number | null;
  alert: boolean;
  lastUpdateStatus: GroupUpdateStatus;
  lastPricedAt: Date | null;
};

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
function sortHoldings(groups: HoldingGroup[], sort: string): HoldingGroup[] {
  if (sort === SORT_NONE) return groups;
  const getValue = sort.startsWith("value")
    ? (group: HoldingGroup) => group.marketMxn
    : (group: HoldingGroup) => group.pnlMxn;
  const asc = sort.endsWith("asc");
  return [...groups].sort((a, b) => {
    const av = getValue(a);
    const bv = getValue(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return asc ? av - bv : bv - av;
  });
}

/** Agrupa compras de la misma carta y variante, conservando cada lote. */
function groupHoldings(holdings: Holding[]): HoldingGroup[] {
  const byCard = new Map<string, Holding[]>();

  for (const holding of holdings) {
    const identity =
      holding.cardId != null
        ? `${holding.gameSlug ?? holding.gameName ?? ""}|${holding.cardId}`
        : [
            holding.gameSlug,
            holding.setName,
            holding.number,
            holding.name,
          ].join("|");
    const key = `${identity}|${holding.printing.trim().toLowerCase()}`;
    const lots = byCard.get(key);
    if (lots) lots.push(holding);
    else byCard.set(key, [holding]);
  }

  return [...byCard.entries()].map(([key, lots]) => {
    const bought = lots.filter((lot) => lot.acquisitionType === "comprada");
    const totalCostMxn = bought.reduce(
      (total, lot) => total + (lot.costBasisMxn ?? 0),
      0,
    );
    const allPriced = lots.every((lot) => lot.marketMxn != null);
    const boughtPriced = bought.every((lot) => lot.marketMxn != null);
    const marketMxn = allPriced
      ? lots.reduce((total, lot) => total + (lot.marketMxn ?? 0), 0)
      : null;
    const boughtMarketMxn = boughtPriced
      ? bought.reduce((total, lot) => total + (lot.marketMxn ?? 0), 0)
      : null;
    const pnlMxn =
      bought.length > 0 && boughtMarketMxn != null
        ? boughtMarketMxn - totalCostMxn
        : null;
    const pnlPct =
      pnlMxn != null && totalCostMxn > 0 ? (pnlMxn / totalCostMxn) * 100 : null;

    const statuses = new Set(lots.map((lot) => lot.lastUpdateStatus));
    const lastUpdateStatus: GroupUpdateStatus =
      statuses.size === 1
        ? (lots[0]?.lastUpdateStatus ?? null)
        : statuses.has("updated")
          ? "partial"
          : statuses.has("failed")
            ? "failed"
            : null;
    const lastPricedAt = lots.reduce<Date | null>((latest, lot) => {
      if (!lot.lastPricedAt) return latest;
      return !latest || lot.lastPricedAt > latest ? lot.lastPricedAt : latest;
    }, null);

    return {
      key,
      holding: lots[0]!,
      lots,
      quantity: lots.length,
      boughtCount: bought.length,
      averageCostMxn: bought.length > 0 ? totalCostMxn / bought.length : null,
      marketMxn,
      pnlMxn,
      pnlPct,
      alert: pnlPct != null && Math.abs(pnlPct) >= 10,
      lastUpdateStatus,
      lastPricedAt,
    };
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
  status: GroupUpdateStatus;
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
  if (status === "partial") {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400",
          className,
        )}
      >
        <TriangleAlertIcon className="size-3" />
        Parcial
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

function GroupPnlCell({ group, size }: { group: HoldingGroup; size?: "sm" }) {
  if (group.marketMxn == null) {
    return <span className="text-xs text-muted-foreground">Sin precio</span>;
  }
  if (group.boughtCount === 0) return <FoundValueBadge />;
  return (
    <PnlBadge
      pnlPct={group.pnlPct}
      pnlMxn={group.pnlMxn}
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

function HoldingGroupDialog({
  group,
  open,
  onOpenChange,
  onAddPurchase,
}: {
  group: HoldingGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddPurchase: (group: HoldingGroup) => void;
}) {
  if (!group) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{group.holding.name ?? "Sin nombre"}</DialogTitle>
          <DialogDescription>
            {group.quantity} {group.quantity === 1 ? "copia" : "copias"} ·{" "}
            {group.holding.printing}
          </DialogDescription>
        </DialogHeader>

        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => onAddPurchase(group)}
        >
          <PlusIcon />
          Agregar compra
        </Button>

        <div className="grid gap-3">
          {group.lots.map((lot, index) => (
            <div key={lot.id} className="grid gap-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Compra {index + 1}</span>
                  <AcquisitionBadge type={lot.acquisitionType} />
                  <UpdateStatusBadge status={lot.lastUpdateStatus} />
                </div>
                <HoldingActions holding={lot} />
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Costo</dt>
                  <dd className="tabular-nums">
                    {lot.acquisitionType === "de_sobre"
                      ? "—"
                      : formatMxn(lot.costBasisMxn)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Fecha</dt>
                  <dd>{formatDate(lot.purchaseDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Valor actual
                  </dt>
                  <dd className="tabular-nums">{formatMxn(lot.marketMxn)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">P&amp;L</dt>
                  <dd className="pt-1">
                    <PnlCell holding={lot} size="sm" />
                  </dd>
                </div>
              </dl>

              {lot.notes && (
                <p className="text-sm text-muted-foreground">{lot.notes}</p>
              )}

              {lot.lastUpdateStatus === "failed" && (
                <RetryPriceButton holdingId={lot.id} name={lot.name} />
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
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
  const [selectedGroupKey, setSelectedGroupKey] = React.useState<string | null>(
    null,
  );
  const [addPurchaseGroupKey, setAddPurchaseGroupKey] = React.useState<
    string | null
  >(null);

  const groups = React.useMemo(() => groupHoldings(holdings), [holdings]);
  const selectedGroup =
    groups.find((group) => group.key === selectedGroupKey) ?? null;
  const addPurchaseGroup =
    groups.find((group) => group.key === addPurchaseGroupKey) ?? null;

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
        ? groups
        : groups.filter((group) => gameKey(group.holding) === activeGame),
    [groups, activeGame],
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

        <span className="text-xs text-muted-foreground tabular-nums">
          {groups.length} {groups.length === 1 ? "carta" : "cartas"} distintas ·{" "}
          {holdings.length} {holdings.length === 1 ? "copia" : "copias"}
        </span>

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
                  {filtered.length} de {groups.length}
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
                <TableHead className="text-center">Cantidad</TableHead>
                <TableHead className="text-right">Costo promedio</TableHead>
                <TableHead className="text-right">Valor actual</TableHead>
                <TableHead>P&amp;L</TableHead>
                <TableHead>Último precio</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((group) => {
                const h = group.holding;
                return (
                  <TableRow
                    key={group.key}
                    className={cn(
                      group.alert &&
                        "bg-amber-500/[0.04] outline -outline-offset-1 outline-amber-500/30",
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
                        <UpdateStatusBadge status={group.lastUpdateStatus} />
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
                    <TableCell className="text-center">
                      <Badge variant="outline">×{group.quantity}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMxn(group.averageCostMxn)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {group.marketMxn == null ? (
                        <span className="text-xs text-muted-foreground">
                          Sin precio
                        </span>
                      ) : (
                        formatMxn(group.marketMxn)
                      )}
                    </TableCell>
                    <TableCell>
                      <GroupPnlCell group={group} />
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                      {group.lastPricedAt ? (
                        formatDateTime(group.lastPricedAt)
                      ) : (
                        <span className="italic">Nunca</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <RetryPriceButton
                          holdingIds={group.lots.map((lot) => lot.id)}
                          name={h.name}
                          iconOnly
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Ver compras de ${h.name}`}
                          onClick={() => setSelectedGroupKey(group.key)}
                        >
                          <EyeIcon />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      {/* ---------------------------------------------------------------- */}
      {/* Vista Galería */}
      {/* ---------------------------------------------------------------- */}
      <TabsContent value="gallery">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {sorted.map((group) => {
            const h = group.holding;
            return (
              <Card
                key={group.key}
                size="sm"
                className={cn(
                  "relative",
                  group.alert && "ring-2 ring-amber-500/40",
                )}
              >
                <UpdateStatusBadge
                  status={group.lastUpdateStatus}
                  className="absolute top-2 left-2 z-10 shadow-sm"
                />
                <Badge
                  variant="secondary"
                  className="absolute top-2 right-2 z-10 shadow-sm"
                >
                  ×{group.quantity}
                </Badge>
                <CardThumb
                  holding={h}
                  className="aspect-[5/7] w-full bg-muted"
                />
                <CardHeader>
                  <CardTitle
                    className="line-clamp-2"
                    title={h.name ?? undefined}
                  >
                    {h.name ?? "Sin nombre"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {h.printing}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Prom. {formatMxn(group.averageCostMxn)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {group.marketMxn == null ? (
                      <span className="text-xs text-muted-foreground">
                        Sin precio — corre Update prices
                      </span>
                    ) : (
                      <span className="font-medium tabular-nums">
                        {formatMxn(group.marketMxn)}
                      </span>
                    )}
                    <GroupPnlCell group={group} size="sm" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {group.lastPricedAt
                      ? `Precio: ${formatDateTime(group.lastPricedAt)}`
                      : "Sin precio registrado"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setSelectedGroupKey(group.key)}
                  >
                    <EyeIcon />
                    Ver {group.quantity === 1 ? "compra" : "compras"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </TabsContent>

      <HoldingGroupDialog
        group={selectedGroup}
        open={selectedGroup != null}
        onOpenChange={(open) => {
          if (!open) setSelectedGroupKey(null);
        }}
        onAddPurchase={(group) => {
          setSelectedGroupKey(null);
          setAddPurchaseGroupKey(group.key);
        }}
      />

      {addPurchaseGroup && (
        <AddPurchaseDialog
          holding={addPurchaseGroup.holding}
          open
          onOpenChange={(open) => {
            if (!open) setAddPurchaseGroupKey(null);
          }}
        />
      )}
    </Tabs>
  );
}

export default HoldingsView;
