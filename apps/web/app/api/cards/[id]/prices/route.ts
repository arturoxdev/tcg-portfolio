import { NextResponse, type NextRequest } from "next/server";

import { getCardPrices, MissingApiKeyError, TcgApiError } from "@/lib/tcg-api";

// Datos en vivo (precios): forzamos runtime, nunca prerender.
export const dynamic = "force-dynamic";

/**
 * GET /api/cards/[id]/prices
 * Proxy server-side de GET /v1/cards/:id/prices (TCG API). Devuelve TODAS las
 * variantes de la carta; el cliente elige el printing en memoria. No filtramos
 * por `printing` vía query porque la API responde 404 si no coincide exacto.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  try {
    const data = await getCardPrices(id, { signal: req.signal });
    return NextResponse.json({ data });
  } catch (err) {
    console.error("[/api/cards/[id]/prices] error:", err);

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
        error: "Error interno al obtener los precios.",
        ...(isDev && { detail: err instanceof Error ? err.message : String(err) }),
      },
      { status: 500 },
    );
  }
}
