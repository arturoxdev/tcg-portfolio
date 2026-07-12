"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@workspace/ui/components/button";
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
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { Textarea } from "@workspace/ui/components/textarea";

import { addHolding, type AddHoldingInput } from "@/lib/actions";
import type { HoldingWithPnl } from "@/lib/queries";

type AcquisitionType = "comprada" | "de_sobre";

function todayIso(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AddPurchaseDialog({
  holding,
  open,
  onOpenChange,
}: {
  holding: HoldingWithPnl;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [quantity, setQuantity] = React.useState("1");
  const [acquisitionType, setAcquisitionType] =
    React.useState<AcquisitionType>("comprada");
  const [cost, setCost] = React.useState("");
  const [purchaseDate, setPurchaseDate] = React.useState(todayIso);
  const [notes, setNotes] = React.useState("");

  const quantityNumber = Number(quantity);
  const costNumber = Number(cost);
  const isComprada = acquisitionType === "comprada";
  const isQuantityValid =
    Number.isInteger(quantityNumber) && quantityNumber >= 1 && quantityNumber <= 100;
  const isCostValid =
    !isComprada || (Number.isFinite(costNumber) && costNumber > 0);
  const canSubmit =
    isQuantityValid && isCostValid && purchaseDate.length > 0 && !isPending;

  function handleOpenChange(next: boolean) {
    if (!isPending) onOpenChange(next);
  }

  function handleSubmit() {
    if (!canSubmit) return;

    const input: AddHoldingInput = {
      cardId: holding.cardId,
      tcgplayerId: holding.tcgplayerId,
      printing: holding.printing,
      acquisitionType,
      costBasisMxn: isComprada ? costNumber : null,
      quantity: quantityNumber,
      purchaseDate,
      notes: notes.trim() || null,
      name: holding.name ?? "",
      setName: holding.setName,
      gameName: holding.gameName,
      gameSlug: holding.gameSlug,
      rarity: holding.rarity,
      number: holding.number,
      imageUrl: holding.imageUrl,
    };

    startTransition(async () => {
      try {
        await addHolding(input);
        toast.success(
          quantityNumber === 1
            ? "Compra agregada"
            : `${quantityNumber} copias agregadas`,
        );
        onOpenChange(false);
        router.refresh();
      } catch (error) {
        toast.error("No se pudo agregar la compra", {
          description:
            error instanceof Error ? error.message : "Ocurrió un error inesperado.",
        });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>Agregar compra</DialogTitle>
          <DialogDescription>
            {holding.name} · {holding.printing}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="add-purchase-quantity">Cantidad</Label>
            <Input
              id="add-purchase-quantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              step={1}
              value={quantity}
              disabled={isPending}
              aria-invalid={!isQuantityValid}
              onChange={(event) => setQuantity(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Todas las copias de esta compra compartirán estos datos.
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Tipo de adquisición</Label>
            <RadioGroup
              value={acquisitionType}
              disabled={isPending}
              onValueChange={(value) =>
                setAcquisitionType(value as AcquisitionType)
              }
              className="grid-cols-2"
            >
              <Label
                htmlFor="new-purchase-bought"
                className="cursor-pointer rounded-lg border border-input p-2.5 has-data-checked:border-primary has-data-checked:bg-primary/5"
              >
                <RadioGroupItem id="new-purchase-bought" value="comprada" />
                Comprada
              </Label>
              <Label
                htmlFor="new-purchase-pack"
                className="cursor-pointer rounded-lg border border-input p-2.5 has-data-checked:border-primary has-data-checked:bg-primary/5"
              >
                <RadioGroupItem id="new-purchase-pack" value="de_sobre" />
                De sobre
              </Label>
            </RadioGroup>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="add-purchase-cost">Costo por copia (MXN)</Label>
            <Input
              id="add-purchase-cost"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder={isComprada ? "0.00" : "Sin costo (de sobre)"}
              value={isComprada ? cost : ""}
              disabled={isPending || !isComprada}
              aria-invalid={!isCostValid}
              onChange={(event) => setCost(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="add-purchase-date">Fecha de compra</Label>
            <Input
              id="add-purchase-date"
              type="date"
              value={purchaseDate}
              disabled={isPending}
              onChange={(event) => setPurchaseDate(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="add-purchase-notes">Notas</Label>
            <Textarea
              id="add-purchase-notes"
              value={notes}
              disabled={isPending}
              placeholder="Notas opcionales…"
              onChange={(event) => setNotes(event.target.value)}
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
            {isPending ? "Agregando…" : "Agregar compra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
