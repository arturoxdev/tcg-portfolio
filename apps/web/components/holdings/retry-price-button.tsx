"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";

import { retryHoldingPrice } from "@/lib/actions";
import {
  isRateLimited,
  RATE_LIMIT_DESCRIPTION,
  RATE_LIMIT_TITLE,
} from "@/lib/api-error";
import { formatMxn } from "@/lib/format";

export type RetryPriceButtonProps = {
  holdingId: string;
  name?: string | null;
  /** Modo compacto solo-ícono (para la tabla). Default: ícono + texto. */
  iconOnly?: boolean;
  className?: string;
};

/**
 * Botón para reintentar la actualización de precio de UNA carta fallida.
 * Llama a `retryHoldingPrice`, muestra el resultado por toast y refresca la
 * vista para que el badge "No actualizada" pase a "Actualizada".
 */
export function RetryPriceButton({
  holdingId,
  name,
  iconOnly = false,
  className,
}: RetryPriceButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  function handleRetry() {
    if (isPending) return;

    startTransition(async () => {
      try {
        const res = await retryHoldingPrice(holdingId);

        if (res.updated) {
          toast.success(`${res.name} actualizada`, {
            description: `Nuevo valor: ${formatMxn(res.marketPriceMxn)}`,
          });
          router.refresh();
          return;
        }

        if (res.rateLimited) {
          toast.error(RATE_LIMIT_TITLE, { description: RATE_LIMIT_DESCRIPTION });
          return;
        }

        toast.warning(`No se pudo actualizar ${res.name}`, {
          description: res.reason,
        });
      } catch (err) {
        if (isRateLimited(0, err)) {
          toast.error(RATE_LIMIT_TITLE, { description: RATE_LIMIT_DESCRIPTION });
          return;
        }
        const message =
          err instanceof Error ? err.message : "Error al reintentar.";
        toast.error("No se pudo reintentar", { description: message });
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={iconOnly ? "icon-xs" : "sm"}
      onClick={handleRetry}
      disabled={isPending}
      className={className}
      aria-label={
        iconOnly ? `Reintentar precio de ${name ?? "la carta"}` : undefined
      }
      title={iconOnly ? "Reintentar actualización de precio" : undefined}
    >
      <RefreshCwIcon className={cn(isPending && "animate-spin")} />
      {!iconOnly && (isPending ? "Reintentando…" : "Reintentar")}
    </Button>
  );
}

export default RetryPriceButton;
