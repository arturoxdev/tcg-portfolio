import { getFxRate } from "@/lib/settings";
import { FxSettingsForm } from "@/components/settings/fx-settings-form";

// Lee SQLite en cada request: evita prerender estático y garantiza datos frescos.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const fxRate = await getFxRate();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Configuración
        </h1>
        <p className="text-sm text-muted-foreground">
          Configura el tipo de cambio que se usará al actualizar precios y para
          mostrar precios en pesos.
        </p>
      </div>

      <FxSettingsForm initialFxRate={fxRate} />
    </div>
  );
}
