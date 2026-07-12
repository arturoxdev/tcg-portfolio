import Link from "next/link";
import { SearchIcon } from "lucide-react";

import { Button } from "@workspace/ui/components/button";

import { getHoldingsWithPnl } from "@/lib/queries";
import { HoldingsView } from "@/components/holdings/holdings-view";

// Lee SQLite en cada request: evita prerender estático y garantiza datos frescos.
export const dynamic = "force-dynamic";

export default async function HoldingsPage() {
  const holdings = await getHoldingsWithPnl();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Mis cartas
        </h1>
        {holdings.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {holdings.length} {holdings.length === 1 ? "copia" : "copias"} en tu
            portafolio.
          </p>
        )}
      </div>

      {holdings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-12 text-center">
          <div className="flex flex-col gap-1">
            <p className="font-medium">Aún no tienes cartas</p>
            <p className="text-sm text-muted-foreground">
              Empieza a construir tu portafolio agregando tu primera carta.
            </p>
          </div>
          <Button render={<Link href="/search" />}>
            <SearchIcon />
            Busca y agrega tu primera carta
          </Button>
        </div>
      ) : (
        <HoldingsView holdings={holdings} />
      )}
    </div>
  );
}
