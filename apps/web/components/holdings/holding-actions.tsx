"use client";

import * as React from "react";
import { MoreVerticalIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

import type { HoldingWithPnl } from "@/lib/queries";

import { DeleteHoldingDialog } from "./delete-holding-dialog";
import { EditHoldingDialog } from "./edit-holding-dialog";

export type HoldingActionsProps = {
  holding: HoldingWithPnl;
  /** Tamaño del botón disparador del menú. */
  size?: "icon" | "icon-sm" | "icon-xs";
  /** Clase extra para el botón disparador (p.ej. posicionarlo en galería). */
  triggerClassName?: string;
};

/**
 * Menú de acciones (Editar / Eliminar) de un holding. Encapsula el
 * `DropdownMenu` y ambos diálogos como hermanos, controlando su `open` con
 * estado local: así los diálogos no se desmontan al cerrarse el menú.
 */
export function HoldingActions({
  holding,
  size = "icon-sm",
  triggerClassName,
}: HoldingActionsProps) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size={size}
              className={triggerClassName}
              aria-label={`Acciones para ${holding.name}`}
            >
              <MoreVerticalIcon />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <PencilIcon />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2Icon />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditHoldingDialog
        holding={holding}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeleteHoldingDialog
        holding={holding}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}

export default HoldingActions;
