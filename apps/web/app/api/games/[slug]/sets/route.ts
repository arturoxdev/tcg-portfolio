import { NextResponse, type NextRequest } from "next/server";

import { getGameSets, MissingApiKeyError, TcgApiError } from "@/lib/tcg-api";

// Aunque es endpoint público, forzamos runtime para leer searchParams frescos.
export const dynamic = "force-dynamic";

/** Parsea a entero; devuelve undefined si falta o es NaN. */
function parseIntParam(value: string | null): number | undefined {
  if (value === null) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * GET /api/games/[slug]/sets
 * Proxy server-side de GET /v1/games/:slug/sets (TCG API). Sets de un juego,
 * paginados. Devuelve el TcgListResponse<TcgSet> completo tal cual.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const sp = req.nextUrl.searchParams;

  const page = parseIntParam(sp.get("page"));
  const per_page = parseIntParam(sp.get("per_page"));

  try {
    const result = await getGameSets(slug, { page, per_page });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/games/[slug]/sets] error:", err);

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
        error: "Error interno al obtener los sets.",
        ...(isDev && { detail: err instanceof Error ? err.message : String(err) }),
      },
      { status: 500 },
    );
  }
}
