// Tipos crudos de la TCG API (https://api.tcgapi.dev).
// Los nombres de campo usan snake_case EXACTO como los devuelve la API.
// Los campos marcados como nullable son los que la doc indica que pueden venir null.

/** Juego (GET /v1/games). Endpoint público. */
export interface TcgGame {
  id: number;
  name: string;
  slug: string;
  priority: number;
  set_count: number;
  card_count: number;
  last_synced_at: string | null;
}

/** Set de un juego (GET /v1/games/:slug/sets). Endpoint público. */
export interface TcgSet {
  id: number;
  name: string;
  slug: string;
  abbreviation: string | null;
  release_date: string | null;
  card_count: number;
  last_synced_at: string | null;
}

/** Tipo de producto (carta o sellado). */
export type TcgProductType = "Cards" | "Sealed Products";

/** Tipo de impresión. */
export type TcgPrinting = "Normal" | "Foil";

/** Item de resultado de búsqueda (GET /v1/search). Requiere key. */
export interface TcgSearchItem {
  id: number;
  name: string;
  clean_name: string;
  number: string | null;
  rarity: string | null;
  image_url: string | null;
  tcgplayer_id: number | null;
  product_type: TcgProductType;
  foil_only: boolean;
  total_listings: number;
  set_name: string;
  game_name: string;
  game_slug: string;
  printing: string;
  // Precios en USD; pueden venir null si no hay datos de mercado.
  market_price: number | null;
  low_price: number | null;
  median_price: number | null;
  lowest_with_shipping: number | null;
  price_updated_at: string | null;
}

/** Precio de una variante de carta (GET /v1/cards/:id/prices). Requiere key. */
export interface TcgCardPrice {
  card_id: number;
  printing: string;
  // Precios en USD; nullable cuando no hay datos de mercado.
  market_price: number | null;
  low_price: number | null;
  median_price: number | null;
  lowest_with_shipping: number | null;
  buylist_price: number | null;
  // Variaciones de precio; nullable cuando no hay histórico suficiente.
  price_change_24h: number | null;
  price_change_7d: number | null;
  price_change_30d: number | null;
  last_updated_at: string | null;
}

/** Metadata completa de una carta (GET /v1/cards/:id). Requiere key. */
export interface TcgCard {
  id: number;
  name: string;
  clean_name: string;
  number: string | null;
  rarity: string | null;
  image_url: string | null;
  tcgplayer_id: number | null;
  tcgplayer_url: string | null;
  product_type: TcgProductType;
  foil_only: boolean;
  total_listings: number;
  hp: number | null;
  // Atributos arbitrarios específicos del juego (estructura variable).
  custom_attributes: Record<string, unknown> | null;
  set_id: number;
  set_name: string;
  game_id: number;
  game_name: string;
}

/** Metadata de paginación. */
export interface TcgMeta {
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

/** Información de rate limit que la API adjunta a respuestas autenticadas. */
export interface TcgRateLimit {
  daily_limit: number;
  daily_remaining: number;
  daily_reset: string;
}

/** Shape genérico de respuesta de lista de la API. */
export interface TcgListResponse<T> {
  data: T[];
  meta?: TcgMeta;
  rate_limit?: TcgRateLimit;
}
