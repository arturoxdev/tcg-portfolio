"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

import { setFxRate } from "@/lib/actions";

type FxSettingsFormProps = {
  initialFxRate: number | null;
};

export function FxSettingsForm({ initialFxRate }: FxSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState<string>(
    initialFxRate != null ? String(initialFxRate) : "",
  );

  function handleSave() {
    const rate = Number.parseFloat(value);

    if (!Number.isFinite(rate) || rate <= 0) {
      toast.error("Ingresa un tipo de cambio válido mayor a 0");
      return;
    }

    startTransition(async () => {
      try {
        await setFxRate(rate);
        toast.success("Tipo de cambio guardado");
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo guardar el tipo de cambio";
        toast.error(message);
      }
    });
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Tipo de cambio (MXN por USD)
          {initialFxRate == null ? (
            <Badge variant="outline">Sin configurar</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          Este valor se usa como predeterminado al presionar &quot;Update
          prices&quot; (solo lo confirmas), y para mostrar los precios de
          búsqueda en pesos mexicanos.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fx-rate">Tipo de cambio</Label>
          <Input
            id="fx-rate"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="18.50"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={isPending}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          No recalcula los snapshots ni el historial pasados: el tipo de cambio
          queda congelado por cada actualización de precios.
        </p>
      </CardContent>

      <CardFooter className="justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Guardando…" : "Guardar"}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default FxSettingsForm;
