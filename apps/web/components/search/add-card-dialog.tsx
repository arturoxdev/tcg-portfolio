"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon, RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Textarea } from "@workspace/ui/components/textarea";

import {
  isRateLimited,
  RATE_LIMIT_DESCRIPTION,
  RATE_LIMIT_TITLE,
} from "@/lib/api-error";
import { addHolding, type AddHoldingInput } from "@/lib/actions";
import { formatDate, formatMxn, formatUsd } from "@/lib/format";
import type { TcgCardPrice, TcgSearchItem } from "@/lib/tcg-types";

type AcquisitionType = "comprada" | "de_sobre";

export type AddCardDialogProps = {
  /** Carta seleccionada que se va a agregar; null = diálogo cerrado/sin item. */
  item: TcgSearchItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tipo de cambio (MXN por USD) configurado en Settings; null si no existe. */
  fxRate: number | null;
};

/**
 * Convierte un `Date` a string ISO 'YYYY-MM-DD' usando los componentes
 * LOCALES (no toISOString, que aplica UTC y puede correr un día según la TZ).
 */
function toLocalIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AddCardDialog({
  item,
  open,
  onOpenChange,
  fxRate,
}: AddCardDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  // --- Variantes (printing) ---
  const [prices, setPrices] = React.useState<TcgCardPrice[]>([]);
  const [pricesLoading, setPricesLoading] = React.useState(false);
  const [pricesError, setPricesError] = React.useState<string | null>(null);
  // Límite diario de la TCG API (429) al cargar variantes: mensaje claro,
  // sin botón de reintento (no sirve hasta que se reinicie la cuota).
  const [pricesRateLimited, setPricesRateLimited] = React.useState(false);

  // --- Campos del formulario ---
  const [printing, setPrinting] = React.useState<string | null>(null);
  const [acquisitionType, setAcquisitionType] =
    React.useState<AcquisitionType>("comprada");
  const [cost, setCost] = React.useState("");
  const [date, setDate] = React.useState<Date>(() => new Date());
  const [dateOpen, setDateOpen] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [triedSubmit, setTriedSubmit] = React.useState(false);

  // Identidad estable de la carta para los efectos (evita refetch en cada render).
  const itemId = item?.id ?? null;
  const itemPrinting = item?.printing ?? null;

  // Carga las variantes de precio al abrir el diálogo (o reintento).
  const loadPrices = React.useCallback(
    async (cardId: number, preferred: string | null, signal?: AbortSignal) => {
      setPricesLoading(true);
      setPricesError(null);
      setPricesRateLimited(false);
      try {
        const res = await fetch(`/api/cards/${cardId}/prices`, { signal });
        const json = (await res.json()) as
          | { data: TcgCardPrice[] }
          | { error: unknown; code?: unknown };
        if (!res.ok || "error" in json) {
          // Límite diario de la TCG API (429): mensaje claro + toast.
          if (isRateLimited(res.status, json)) {
            if (signal?.aborted) return;
            setPrices([]);
            setPrinting(null);
            setPricesRateLimited(true);
            toast.error(RATE_LIMIT_TITLE, {
              description: RATE_LIMIT_DESCRIPTION,
            });
            return;
          }
          throw new Error("No se pudieron cargar las variantes.");
        }
        const data = json.data ?? [];
        setPrices(data);
        // Preselecciona el printing del item si coincide, o el primero.
        const match = data.find((p) => p.printing === preferred);
        setPrinting(match?.printing ?? data[0]?.printing ?? null);
      } catch (err) {
        if (signal?.aborted) return;
        setPrices([]);
        setPrinting(null);
        setPricesError(
          err instanceof Error ? err.message : "Error al cargar variantes.",
        );
      } finally {
        if (!signal?.aborted) setPricesLoading(false);
      }
    },
    [],
  );

  // Al abrir con un item: resetea el formulario y carga variantes.
  React.useEffect(() => {
    if (!open || itemId == null) return;

    // Reset del formulario para cada apertura.
    setAcquisitionType("comprada");
    setCost("");
    setDate(new Date());
    setNotes("");
    setTriedSubmit(false);
    setPrinting(itemPrinting);

    const controller = new AbortController();
    void loadPrices(itemId, itemPrinting, controller.signal);
    return () => controller.abort();
  }, [open, itemId, itemPrinting, loadPrices]);

  // FX válido para convertir precios USD → MXN.
  const hasFx = fxRate != null && fxRate > 0;

  // Precio de mercado (USD) del printing seleccionado, para mostrar como
  // referencia el valor en MXN (NO autocompleta el costo).
  const selectedMarketPrice =
    prices.find((p) => p.printing === printing)?.market_price ?? null;
  const showMarketRef = hasFx && selectedMarketPrice != null;

  const isComprada = acquisitionType === "comprada";
  const costNumber = Number(cost);
  const isCostValid = Number.isFinite(costNumber) && costNumber > 0;
  const printingValid = printing != null && printing.length > 0;
  const canSubmit =
    printingValid && (!isComprada || isCostValid) && !pricesLoading && !isPending;

  function handleRetry() {
    if (itemId == null) return;
    void loadPrices(itemId, itemPrinting);
  }

  function handleSubmit() {
    setTriedSubmit(true);
    if (item == null) return;
    if (!printingValid) {
      toast.error("Selecciona una variante (printing).");
      return;
    }
    if (isComprada && !isCostValid) {
      toast.error("Ingresa un costo de compra mayor que 0.");
      return;
    }

    const input: AddHoldingInput = {
      cardId: item.id,
      tcgplayerId: item.tcgplayer_id,
      printing: printing!,
      acquisitionType,
      costBasisMxn: isComprada ? costNumber : null,
      purchaseDate: toLocalIsoDate(date),
      notes: notes.trim() ? notes.trim() : null,
      // Metadata cacheada del item.
      name: item.name,
      setName: item.set_name,
      gameName: item.game_name,
      gameSlug: item.game_slug,
      rarity: item.rarity,
      number: item.number,
      imageUrl: item.image_url,
    };

    startTransition(async () => {
      try {
        await addHolding(input);
        toast.success("Carta agregada");
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "No se pudo agregar la carta.";
        toast.error(message);
      }
    });
  }

  function handleOpenChange(next: boolean) {
    if (isPending) return; // no cerrar mientras guarda
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>Agregar carta</DialogTitle>
          <DialogDescription>
            {item
              ? `${item.name}${item.set_name ? ` · ${item.set_name}` : ""}`
              : "Selecciona una carta para agregarla a tu portafolio."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Variante / printing */}
          <div className="grid gap-2">
            <Label>Variante</Label>
            {pricesLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : pricesRateLimited ? (
              <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-0.5">
                  <p className="font-medium">{RATE_LIMIT_TITLE}</p>
                  <p className="text-amber-700/90 dark:text-amber-400/90">
                    {RATE_LIMIT_DESCRIPTION}
                  </p>
                </div>
              </div>
            ) : pricesError ? (
              <div className="flex items-center gap-2">
                <p className="text-xs text-destructive">{pricesError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                >
                  <RotateCwIcon />
                  Reintentar
                </Button>
              </div>
            ) : prices.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No hay variantes disponibles para esta carta.
              </p>
            ) : (
              <Select
                value={printing}
                onValueChange={(value) => setPrinting(value as string)}
              >
                <SelectTrigger
                  className="w-full"
                  aria-invalid={triedSubmit && !printingValid}
                >
                  <SelectValue placeholder="Selecciona una variante" />
                </SelectTrigger>
                <SelectContent>
                  {prices.map((p) => {
                    const showMxn = hasFx && p.market_price != null;
                    return (
                      <SelectItem key={p.printing} value={p.printing}>
                        <span className="flex w-full items-center justify-between gap-4">
                          <span>{p.printing}</span>
                          {showMxn ? (
                            <span className="flex items-baseline gap-1.5 tabular-nums">
                              <span>{formatMxn(p.market_price! * fxRate!)}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatUsd(p.market_price)}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground tabular-nums">
                              {formatUsd(p.market_price)}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Tipo de adquisición */}
          <div className="grid gap-2">
            <Label>Tipo de adquisición</Label>
            <RadioGroup
              value={acquisitionType}
              onValueChange={(value) =>
                setAcquisitionType(value as AcquisitionType)
              }
              className="grid grid-cols-2 gap-2"
            >
              <Label className="flex items-center gap-2 font-normal">
                <RadioGroupItem value="comprada" />
                Comprada
              </Label>
              <Label className="flex items-center gap-2 font-normal">
                <RadioGroupItem value="de_sobre" />
                De sobre
              </Label>
            </RadioGroup>
          </div>

          {/* Costo de compra (MXN) */}
          <div className="grid gap-2">
            <Label htmlFor="add-card-cost">Costo de compra (MXN)</Label>
            <Input
              id="add-card-cost"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={isComprada ? cost : ""}
              disabled={!isComprada || isPending}
              aria-invalid={
                isComprada && (triedSubmit || cost !== "") && !isCostValid
              }
              onChange={(e) => setCost(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Solo el precio de la carta (sin envío ni comisiones).
            </p>
            {showMarketRef && (
              <p className="text-xs text-muted-foreground">
                Valor de mercado actual:{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {formatMxn(selectedMarketPrice! * fxRate!)}
                </span>
              </p>
            )}
            {isComprada && (triedSubmit || cost !== "") && !isCostValid && (
              <p className="text-xs text-destructive">
                Ingresa un monto mayor que 0.
              </p>
            )}
          </div>

          {/* Fecha de compra */}
          <div className="grid gap-2">
            <Label>Fecha de compra</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending}
                    className="w-full justify-start font-normal"
                  >
                    <CalendarIcon />
                    {formatDate(date)}
                  </Button>
                }
              />
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    if (d) {
                      setDate(d);
                      setDateOpen(false);
                    }
                  }}
                  disabled={{ after: new Date() }}
                  autoFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Notas */}
          <div className="grid gap-2">
            <Label htmlFor="add-card-notes">Notas (opcional)</Label>
            <Textarea
              id="add-card-notes"
              placeholder="Comentarios sobre esta carta…"
              value={notes}
              disabled={isPending}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" disabled={isPending}>
                Cancelar
              </Button>
            }
          />
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isPending ? "Agregando…" : "Agregar carta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddCardDialog;
