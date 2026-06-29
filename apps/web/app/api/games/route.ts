import { NextResponse, type NextRequest } from "next/server";

import { getGames, MissingApiKeyError, TcgApiError } from "@/lib/tcg-api";

// Aunque es endpoint público, forzamos runtime para leer searchParams frescos.
export const dynamic = "force-dynamic";

/** Parsea a entero; devuelve undefined si falta o es NaN. */
function parseIntParam(value: string | null): number | undefined {
  if (value === null) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * GET /api/games
 * Proxy server-side de GET /v1/games (TCG API). Lista de juegos paginada.
 * Devuelve el TcgListResponse<TcgGame> completo tal cual.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const page = parseIntParam(sp.get("page"));
  const per_page = parseIntParam(sp.get("per_page"));

  try {
    const result = await getGames({ page, per_page });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/games] error:", err);

    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    if (err instanceof TcgApiError) {
      if (err.status === 429) {
        return NextResponse.json(
          {
            error:
              "Se alcanzó el límite diario de la TCG API (100 consultas/día en toda la cuenta). Se reinicia a medianoche UTC.",
            code: "RATE_LIMIT_EXCEEDED",
          },
          { status: 429 },
        );
      }
      return NextResponse.json({ error: err.body ?? err.message }, { status: err.status });
    }

    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      {
        error: "Error interno al obtener los juegos.",
        ...(isDev && { detail: err instanceof Error ? err.message : String(err) }),
      },
      { status: 500 },
    );
  }
}
