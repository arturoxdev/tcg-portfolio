import { getFxRate } from "@/lib/settings";
import { getGames } from "@/lib/tcg-api";
import type { TcgGame } from "@/lib/tcg-types";

import { SearchView } from "@/components/search/search-view";

// Carga juegos en vivo desde la TCG API; runtime, nunca prerender.
export const dynamic = "force-dynamic";

export default async function SearchPage() {
  // Pre-carga los juegos server-side para el filtro. Si falla, pasamos [] y el
  // cliente puede operar sin el filtro de juego (o reintentar al recargar).
  let games: TcgGame[] = [];
  try {
    const res = await getGames({ per_page: 100 });
    games = res.data ?? [];
  } catch {
    games = [];
  }

  // Tipo de cambio (MXN por USD) para mostrar los precios en pesos.
  // null si no está configurado en Settings.
  const fxRate = await getFxRate();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Buscar cartas
        </h1>
        <p className="text-sm text-muted-foreground">
          Busca cartas por nombre, filtra por juego, set, rareza y precio, y
          agrégalas a tu portafolio.
        </p>
      </div>

      <SearchView games={games} fxRate={fxRate} />
    </div>
  );
}
