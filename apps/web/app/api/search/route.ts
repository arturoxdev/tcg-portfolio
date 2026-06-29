import { NextResponse, type NextRequest } from "next/server";

import {
  MissingApiKeyError,
  searchCards,
  TcgApiError,
  type SearchCardsParams,
} from "@/lib/tcg-api";
import type { TcgPrinting, TcgProductType } from "@/lib/tcg-types";

// Datos en vivo (precios): leer searchParams en runtime, nunca prerender.
export const dynamic = "force-dynamic";

/** Parsea a entero; devuelve undefined si falta o es NaN. */
function parseIntParam(value: string | null): number | undefined {
  if (value === null) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

/** Parsea a float; devuelve undefined si falta o es NaN. */
function parseFloatParam(value: string | null): number | undefined {
  if (value === null) return undefined;
  const n = Number.parseFloat(value);
  return Number.isNaN(n) ? undefined : n;
}

/** Devuelve el string solo si está presente y no es vacío; si no, undefined. */
function strParam(value: string | null): string | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * GET /api/search
 * Proxy server-side de GET /v1/search (TCG API) para que el cliente busque
 * cartas sin exponer la API key. Devuelve el TcgListResponse<TcgSearchItem>
 * completo (data, meta, rate_limit) tal cual.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const q = strParam(sp.get("q"));
  if (!q || q.length < 2) {
    return NextResponse.json(
      { error: "El parámetro 'q' es requerido y debe tener al menos 2 caracteres." },
      { status: 400 },
    );
  }

  // Construye los params omitiendo los no presentes (undefined).
  const params: SearchCardsParams = {
    q,
    game: strParam(sp.get("game")),
    set_id: parseIntParam(sp.get("set_id")),
    rarity: strParam(sp.get("rarity")),
    type: strParam(sp.get("type")) as TcgProductType | undefined,
    printing: strParam(sp.get("printing")) as TcgPrinting | undefined,
    min_price: parseFloatParam(sp.get("min_price")),
    max_price: parseFloatParam(sp.get("max_price")),
    sort: strParam(sp.get("sort")) as SearchCardsParams["sort"],
    page: parseIntParam(sp.get("page")),
    per_page: parseIntParam(sp.get("per_page")),
  };

  try {
    const result = await searchCards(params, { signal: req.signal });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/search] error:", err);

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
        error: "Error interno al buscar cartas.",
        ...(isDev && { detail: err instanceof Error ? err.message : String(err) }),
      },
      { status: 500 },
    );
  }
}
