"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { Textarea } from "@workspace/ui/components/textarea";

import type { HoldingWithPnl } from "@/lib/queries";
import { updateHolding } from "@/lib/actions";
import { formatDate } from "@/lib/format";

type AcquisitionType = "comprada" | "de_sobre";

/**
 * Parsea una fecha ISO 'YYYY-MM-DD' a un `Date` en horario local (mediodía
 * para evitar desfases por timezone) y viceversa.
 */
function isoToLocalDate(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return undefined;
  const [, y, mo, d] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), 12, 0, 0, 0);
}

function localDateToIso(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

export type EditHoldingDialogProps = {
  holding: HoldingWithPnl;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditHoldingDialog({
  holding,
  open,
  onOpenChange,
}: EditHoldingDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const [printing, setPrinting] = React.useState(holding.printing);
  const [acquisitionType, setAcquisitionType] =
    React.useState<AcquisitionType>(holding.acquisitionType);
  const [cost, setCost] = React.useState(
    holding.costBasisMxn != null ? String(holding.costBasisMxn) : "",
  );
  const [purchaseDate, setPurchaseDate] = React.useState(
    holding.purchaseDate ?? "",
  );
  const [notes, setNotes] = React.useState(holding.notes ?? "");
  const [dateOpen, setDateOpen] = React.useState(false);

  // Re-sincroniza el formulario cada vez que se (re)abre con un holding dado.
  React.useEffect(() => {
    if (!open) return;
    setPrinting(holding.printing);
    setAcquisitionType(holding.acquisitionType);
    setCost(holding.costBasisMxn != null ? String(holding.costBasisMxn) : "");
    setPurchaseDate(holding.purchaseDate ?? "");
    setNotes(holding.notes ?? "");
  }, [open, holding]);

  const isDeSobre = acquisitionType === "de_sobre";
  const costNumber = Number(cost);
  const isCostValid =
    isDeSobre || (Number.isFinite(costNumber) && costNumber > 0);
  const isPrintingValid = printing.trim().length > 0;
  const canSubmit = isPrintingValid && isCostValid && !isPending;

  const selectedDate = isoToLocalDate(purchaseDate);

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    onOpenChange(next);
  }

  function handleSubmit() {
    if (!canSubmit) return;

    startTransition(async () => {
      try {
        await updateHolding(holding.id, {
          printing: printing.trim(),
          acquisitionType,
          costBasisMxn: isDeSobre ? null : costNumber,
          ...(purchaseDate ? { purchaseDate } : {}),
          notes: notes.trim() ? notes.trim() : null,
        });
        toast.success("Carta actualizada");
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Ocurrió un error al guardar los cambios.";
        toast.error("No se pudo actualizar la carta", { description: message });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!isPending}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Editar carta</DialogTitle>
          <DialogDescription>{holding.name}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Printing */}
          <div className="grid gap-2">
            <Label htmlFor="edit-printing">Printing / variante</Label>
            <Input
              id="edit-printing"
              value={printing}
              disabled={isPending}
              aria-invalid={!isPrintingValid}
              placeholder="Ej. Normal, Holofoil, Reverse Holofoil…"
              onChange={(e) => setPrinting(e.target.value)}
            />
            {!isPrintingValid && (
              <p className="text-xs text-destructive">
                El printing no puede estar vacío.
              </p>
            )}
          </div>

          {/* Tipo de adquisición */}
          <div className="grid gap-2">
            <Label>Tipo de adquisición</Label>
            <RadioGroup
              value={acquisitionType}
              disabled={isPending}
              onValueChange={(v) =>
                setAcquisitionType(v as AcquisitionType)
              }
              className="grid-cols-2"
            >
              <Label
                htmlFor="acq-comprada"
                className="cursor-pointer rounded-lg border border-input p-2.5 has-data-checked:border-primary has-data-checked:bg-primary/5"
              >
                <RadioGroupItem id="acq-comprada" value="comprada" />
                Comprada
              </Label>
              <Label
                htmlFor="acq-de_sobre"
                className="cursor-pointer rounded-lg border border-input p-2.5 has-data-checked:border-primary has-data-checked:bg-primary/5"
              >
                <RadioGroupItem id="acq-de_sobre" value="de_sobre" />
                De sobre
              </Label>
            </RadioGroup>
          </div>

          {/* Costo MXN */}
          <div className="grid gap-2">
            <Label htmlFor="edit-cost">Costo (MXN)</Label>
            <Input
              id="edit-cost"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder={isDeSobre ? "Sin costo (de sobre)" : "0.00"}
              value={isDeSobre ? "" : cost}
              disabled={isPending || isDeSobre}
              aria-invalid={!isDeSobre && cost !== "" && !isCostValid}
              onChange={(e) => setCost(e.target.value)}
            />
            {isDeSobre ? (
              <p className="text-xs text-muted-foreground">
                Las cartas de sobre no tienen costo: solo se registra su valor
                encontrado.
              </p>
            ) : (
              !isCostValid && (
                <p className="text-xs text-destructive">
                  Ingresa un costo mayor que 0.
                </p>
              )
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
                    className="justify-start font-normal"
                  >
                    <CalendarIcon />
                    {selectedDate
                      ? formatDate(purchaseDate)
                      : "Selecciona una fecha"}
                  </Button>
                }
              />
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  defaultMonth={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setPurchaseDate(localDateToIso(date));
                      setDateOpen(false);
                    }
                  }}
                  autoFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Notas */}
          <div className="grid gap-2">
            <Label htmlFor="edit-notes">Notas</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              disabled={isPending}
              placeholder="Notas opcionales…"
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
            {isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditHoldingDialog;
