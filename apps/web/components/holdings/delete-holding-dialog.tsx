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

import type { HoldingWithPnl } from "@/lib/queries";
import { deleteHolding } from "@/lib/actions";

export type DeleteHoldingDialogProps = {
  holding: HoldingWithPnl;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeleteHoldingDialog({
  holding,
  open,
  onOpenChange,
}: DeleteHoldingDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    onOpenChange(next);
  }

  function handleDelete() {
    if (isPending) return;
    startTransition(async () => {
      try {
        await deleteHolding(holding.id);
        toast.success("Carta eliminada");
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Ocurrió un error al eliminar la carta.";
        toast.error("No se pudo eliminar la carta", { description: message });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>¿Eliminar esta carta del portafolio?</DialogTitle>
          <DialogDescription>
            Vas a eliminar{" "}
            <span className="font-medium text-foreground">{holding.name}</span>{" "}
            ({holding.printing}). Esta acción también borra su historial de
            precios y no se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" disabled={isPending}>
                Cancelar
              </Button>
            }
          />
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteHoldingDialog;
