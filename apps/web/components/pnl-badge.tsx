import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/ui/lib/utils";

import { formatMxn, formatPct } from "@/lib/format";

/** Umbral (en %) a partir del cual el P&L se considera una alerta y se resalta. */
export const PNL_ALERT_THRESHOLD = 10;

export type PnlBadgeProps = {
  /** P&L en puntos porcentuales (ej. 12.3 = +12.3%). `null` → no renderiza. */
  pnlPct: number | null | undefined;
  /** P&L absoluto en MXN; si se pasa, se muestra entre paréntesis. */
  pnlMxn?: number | null;
  /** Tamaño visual del badge. */
  size?: "sm" | "default";
  className?: string;
};

/**
 * Badge reutilizable de P&L. Verde si >= 0, rojo si < 0. Cuando
 * `|pnlPct| >= PNL_ALERT_THRESHOLD` se resalta con un anillo y un ícono de
 * tendencia (alerta de ±10%). Sirve igual para tabla y galería.
 */
export function PnlBadge({
  pnlPct,
  pnlMxn,
  size = "default",
  className,
}: PnlBadgeProps) {
  if (pnlPct == null || !Number.isFinite(pnlPct)) {
    return <span className="text-muted-foreground tabular-nums">—</span>;
  }

  const isPositive = pnlPct >= 0;
  const isAlert = Math.abs(pnlPct) >= PNL_ALERT_THRESHOLD;
  const Icon = isPositive ? TrendingUpIcon : TrendingDownIcon;

  return (
    <Badge
      variant="secondary"
      className={cn(
        "border-transparent tabular-nums",
        size === "sm" && "h-5 px-1.5 text-[0.7rem]",
        isPositive
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "bg-red-500/15 text-red-600 dark:text-red-400",
        isAlert &&
          (isPositive
            ? "ring-2 ring-emerald-500/50"
            : "ring-2 ring-red-500/50"),
        className,
      )}
    >
      {isAlert && <Icon aria-hidden="true" />}
      <span>{formatPct(pnlPct)}</span>
      {pnlMxn != null && Number.isFinite(pnlMxn) && (
        <span className="opacity-70">({formatMxn(pnlMxn)})</span>
      )}
    </Badge>
  );
}

export default PnlBadge;
