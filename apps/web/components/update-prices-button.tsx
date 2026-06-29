"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";
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
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Progress } from "@workspace/ui/components/progress";

import {
  isRateLimited,
  RATE_LIMIT_DESCRIPTION,
  RATE_LIMIT_TITLE,
} from "@/lib/api-error";
import { getFxRate, runPriceUpdate } from "@/lib/actions";

const FX_STORAGE_KEY = "tcg:lastFxRate";

export function UpdatePricesButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [fx, setFx] = React.useState("");
  const [progress, setProgress] = React.useState(0);
  const [isPending, startTransition] = React.useTransition();
  // FX configurado en Settings: number si hay, null si no, undefined mientras carga.
  const [settingsFx, setSettingsFx] = React.useState<number | null | undefined>(
    undefined,
  );
  const [isLoadingFx, setIsLoadingFx] = React.useState(false);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Al abrir el diálogo, precarga el FX configurado en Settings. Si no hay,
  // cae al último valor usado en localStorage; si tampoco, deja el input vacío.
  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setIsLoadingFx(true);
    setSettingsFx(undefined);

    const fallbackFromStorage = () => {
      try {
        const saved = window.localStorage.getItem(FX_STORAGE_KEY);
        if (saved) setFx(saved);
      } catch {
        // localStorage puede no estar disponible; se ignora.
      }
    };

    void (async () => {
      try {
        const rate = await getFxRate();
        if (cancelled) return;
        setSettingsFx(rate);
        if (rate != null) {
          setFx(String(rate));
        } else {
          fallbackFromStorage();
        }
      } catch {
        if (cancelled) return;
        // Si falla la lectura de Settings, intenta el último valor local.
        setSettingsFx(null);
        fallbackFromStorage();
      } finally {
        if (!cancelled) setIsLoadingFx(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const clearProgressInterval = React.useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  React.useEffect(() => clearProgressInterval, [clearProgressInterval]);

  const fxNumber = Number(fx);
  const isFxValid = Number.isFinite(fxNumber) && fxNumber > 0;

  function startFakeProgress() {
    setProgress(8);
    clearProgressInterval();
    intervalRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        // Avance decreciente para que parezca natural.
        const next = p + Math.max(1, (90 - p) * 0.12);
        return Math.min(90, next);
      });
    }, 300);
  }

  function handleConfirm() {
    if (isPending || isLoadingFx) return;

    if (!isFxValid) {
      toast.error("Tipo de cambio inválido", {
        description: "Ingresa un número mayor que 0.",
      });
      return;
    }

    const fxRate = fxNumber;
    try {
      window.localStorage.setItem(FX_STORAGE_KEY, String(fxRate));
    } catch {
      // se ignora
    }

    startFakeProgress();

    startTransition(async () => {
      try {
        const result = await runPriceUpdate(fxRate);

        clearProgressInterval();
        setProgress(100);

        if (result.message === "Sin cartas") {
          toast.info("No tienes cartas para actualizar");
        } else if (result.rateLimited) {
          // Se cortó por el límite diario de la TCG API (429).
          toast.error(RATE_LIMIT_TITLE, { description: RATE_LIMIT_DESCRIPTION });
          // Si alcanzó a actualizar algunas antes del corte, avísalo aparte.
          if (result.updated > 0) {
            toast.info(
              `Se actualizaron ${result.updated} cartas antes de alcanzar el límite`,
            );
          }
          if (result.failed.length > 0) {
            toast.warning(`${result.failed.length} no se pudieron actualizar`, {
              description: result.failed.map((f) => f.name).join(", "),
            });
          }
        } else {
          if (result.updated > 0) {
            toast.success(`${result.updated} cartas actualizadas`);
          }
          if (result.failed.length > 0) {
            toast.warning(`${result.failed.length} no se pudieron actualizar`, {
              description: result.failed.map((f) => f.name).join(", "),
            });
          }
          if (result.updated === 0 && result.failed.length === 0) {
            toast.info("No hubo cambios de precio");
          }
        }

        setOpen(false);
        router.refresh();
      } catch (err) {
        clearProgressInterval();
        setProgress(0);
        // Por si el 429 llegara como error tipado en lugar de result.rateLimited.
        if (isRateLimited(0, err)) {
          toast.error(RATE_LIMIT_TITLE, {
            description: RATE_LIMIT_DESCRIPTION,
          });
          return;
        }
        const message =
          err instanceof Error
            ? err.message
            : "Ocurrió un error al actualizar precios.";
        toast.error("No se pudieron actualizar los precios", {
          description: message,
        });
      }
    });
  }

  function handleOpenChange(next: boolean) {
    // Evita cerrar el diálogo mientras corre la actualización.
    if (isPending) return;
    if (!next) {
      clearProgressInterval();
      setProgress(0);
    }
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <RefreshCwIcon />
            <span className="hidden sm:inline">Update prices</span>
          </Button>
        }
      />
      <DialogContent showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>Actualizar precios</DialogTitle>
          <DialogDescription>
            Confirma el tipo de cambio (MXN por USD) para recalcular el valor de
            mercado de tu colección. Se precarga el configurado en Settings; si
            cambió hoy, puedes ajustarlo aquí.
          </DialogDescription>
        </DialogHeader>

        {settingsFx === null && (
          <div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
            <p>
              No has configurado el tipo de cambio. Ve a{" "}
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                render={<Link href="/settings" />}
              >
                Settings
              </Button>{" "}
              o ingrésalo aquí.
            </p>
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="fx-rate">Tipo de cambio (MXN por USD)</Label>
          <Input
            id="fx-rate"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="18.50"
            value={fx}
            disabled={isPending || isLoadingFx}
            aria-invalid={fx !== "" && !isFxValid}
            aria-busy={isLoadingFx}
            onChange={(e) => setFx(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
            }}
          />
          {isLoadingFx ? (
            <p className="text-xs text-muted-foreground">
              Cargando tipo de cambio…
            </p>
          ) : (
            fx !== "" &&
            !isFxValid && (
              <p className="text-xs text-destructive">
                Ingresa un número mayor que 0.
              </p>
            )
          )}
        </div>

        {isPending && (
          <Progress value={progress} aria-label="Progreso de la actualización" />
        )}

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" disabled={isPending}>
                Cancelar
              </Button>
            }
          />
          <Button
            onClick={handleConfirm}
            disabled={!isFxValid || isPending || isLoadingFx}
          >
            {isPending ? "Actualizando…" : "Actualizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UpdatePricesButton;
