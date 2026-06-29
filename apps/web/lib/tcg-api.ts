// SERVER ONLY — usa TCG_API_KEY, nunca importar en cliente
//
// Cliente server-side de la TCG API (https://api.tcgapi.dev).
// Endpoints públicos (games / sets) no requieren key; el resto sí.

import type {
  TcgCard,
  TcgCardPrice,
  TcgGame,
  TcgListResponse,
  TcgPrinting,
  TcgProductType,
  TcgSearchItem,
  TcgSet,
} from "./tcg-types.js";

export const TCG_BASE_URL = "https://api.tcgapi.dev";

/** Error tipado para fallos de la TCG API; incluye status HTTP y body crudo. */
export class TcgApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `TCG API error ${status}`);
    this.name = "TcgApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Error específico para cuando falta configurar TCG_API_KEY en el entorno.
 * Permite a los route handlers devolver un mensaje claro y accionable
 * (en vez del genérico "Error interno") al usuario/dev.
 */
export class MissingApiKeyError extends Error {
  constructor(
    message = "Falta configurar TCG_API_KEY en apps/web/.env (requerido para endpoints autenticados de la TCG API).",
  ) {
    super(message);
    this.name = "MissingApiKeyError";
  }
}

/** Opciones internas para tcgFetch. */
interface TcgFetchOptions {
  /** Si true (default), añade el header X-API-Key. */
  auth?: boolean;
  /** AbortSignal opcional para cancelar la petición. */
  signal?: AbortSignal;
}

/**
 * Helper interno: construye la URL, añade auth si corresponde, hace fetch
 * sin cache (datos de precio en vivo), parsea JSON y lanza TcgApiError si !ok.
 */
async function tcgFetch<T>(path: string, options: TcgFetchOptions = {}): Promise<T> {
  const { auth = true, signal } = options;

  const url = `${TCG_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (auth) {
    const apiKey = process.env.TCG_API_KEY?.trim();
    if (!apiKey) {
      throw new MissingApiKeyError();
    }
    headers["X-API-Key"] = apiKey;
  }

  const res = await fetch(url, {
    headers,
    cache: "no-store", // precios en vivo: nunca cachear
    signal,
  });

  // Intenta parsear el cuerpo aunque la respuesta sea un error.
  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text; // body no-JSON (p.ej. HTML de error): lo dejamos como string
    }
  }

  if (!res.ok) {
    throw new TcgApiError(
      res.status,
      body,
      `TCG API ${res.status} ${res.statusText} en ${path}`,
    );
  }

  return body as T;
}

/** Construye un querystring omitiendo params undefined, null o string vacío. */
function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.length === 0) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Lista de juegos. Endpoint público (sin key). */
export function getGames(params?: {
  page?: number;
  per_page?: number;
}): Promise<TcgListResponse<TcgGame>> {
  const qs = buildQuery({
    page: params?.page,
    per_page: params?.per_page,
  });
  return tcgFetch<TcgListResponse<TcgGame>>(`/v1/games${qs}`, { auth: false });
}

/** Sets de un juego por slug. Endpoint público (sin key). */
export function getGameSets(
  slug: string,
  params?: { page?: number; per_page?: number },
): Promise<TcgListResponse<TcgSet>> {
  const qs = buildQuery({
    page: params?.page,
    per_page: params?.per_page,
  });
  return tcgFetch<TcgListResponse<TcgSet>>(
    `/v1/games/${encodeURIComponent(slug)}/sets${qs}`,
    { auth: false },
  );
}

/** Parámetros de búsqueda de cartas. */
export interface SearchCardsParams {
  /** Texto de búsqueda; mínimo 2 caracteres (requerido). */
  q: string;
  game?: string;
  set_id?: number;
  rarity?: string;
  type?: TcgProductType;
  printing?: TcgPrinting;
  min_price?: number;
  max_price?: number;
  sort?: "relevance" | "price_asc" | "price_desc" | "name";
  page?: number;
  per_page?: number;
}

/** Búsqueda de cartas. Requiere key. Valida q.length >= 2. */
export function searchCards(
  params: SearchCardsParams,
  options?: { signal?: AbortSignal },
): Promise<TcgListResponse<TcgSearchItem>> {
  const q = params.q?.trim() ?? "";
  if (q.length < 2) {
    throw new Error("searchCards: el parámetro 'q' debe tener al menos 2 caracteres.");
  }

  const qs = buildQuery({
    q,
    game: params.game,
    set_id: params.set_id,
    rarity: params.rarity,
    type: params.type,
    printing: params.printing,
    min_price: params.min_price,
    max_price: params.max_price,
    sort: params.sort,
    page: params.page,
    per_page: params.per_page,
  });

  return tcgFetch<TcgListResponse<TcgSearchItem>>(`/v1/search${qs}`, {
    auth: true,
    signal: options?.signal,
  });
}

/**
 * Precios de una carta. Requiere key. Devuelve TODAS las variantes.
 *
 * ⚠️ NO se filtra por `printing` vía query param: la API responde **404** si el
 * valor exacto no coincide con la variante real (p. ej. pedir `?printing=Normal`
 * a una carta que en realidad es `Foil`/`Holofoil`). En su lugar pedimos todas
 * las variantes y el llamador elige la correcta en memoria (pickPriceForPrinting).
 *
 * ⚠️ Normaliza SIEMPRE a array: si la carta tiene una sola variante, la API
 * puede devolver `data` como un objeto único en vez de un array.
 */
export async function getCardPrices(
  cardId: number | string,
  options?: { signal?: AbortSignal },
): Promise<TcgCardPrice[]> {
  const res = await tcgFetch<{ data: TcgCardPrice[] | TcgCardPrice | null }>(
    `/v1/cards/${encodeURIComponent(String(cardId))}/prices`,
    { auth: true, signal: options?.signal },
  );

  const data = res.data;
  if (data == null) return [];
  return Array.isArray(data) ? data : [data];
}

/** Metadata completa de una carta. Requiere key. Devuelve `data`. */
export async function getCardById(
  cardId: number | string,
  options?: { signal?: AbortSignal },
): Promise<TcgCard> {
  const res = await tcgFetch<{ data: TcgCard }>(
    `/v1/cards/${encodeURIComponent(String(cardId))}`,
    { auth: true, signal: options?.signal },
  );
  return res.data;
}
