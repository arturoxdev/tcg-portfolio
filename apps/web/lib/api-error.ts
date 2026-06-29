// PURO / client-safe: SIN sonner, SIN "use server", SIN imports server-only.
// Pueden importarlo client components sin arrastrar dependencias de servidor.
//
// Contrato compartido para detectar el límite diario de la TCG API (HTTP 429,
// code "RATE_LIMIT_EXCEEDED") tanto en route handlers como en la UI.

/** Título corto para el aviso de rate limit (UI). */
export const RATE_LIMIT_TITLE = "Límite diario de la API alcanzado";

/** Descripción del aviso de rate limit (UI). */
export const RATE_LIMIT_DESCRIPTION =
  "Son 100 consultas/día en toda la cuenta de la TCG API. Se reinicia a medianoche UTC (las 18:00 en CDMX aprox.).";

/** Código identificable que devuelven los route handlers ante un 429. */
export const RATE_LIMIT_CODE = "RATE_LIMIT_EXCEEDED";

/** Forma mínima de un body que puede traer el code de rate limit. */
function hasRateLimitCode(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const code = (value as { code?: unknown }).code;
  return code === RATE_LIMIT_CODE;
}

/**
 * Determina si una respuesta corresponde al límite diario de la TCG API.
 * Tolerante a `body` unknown/null. Devuelve true si:
 *  - `status === 429`, o
 *  - `body.code === "RATE_LIMIT_EXCEEDED"`, o
 *  - `body.error?.code === "RATE_LIMIT_EXCEEDED"`.
 */
export function isRateLimited(status: number, body?: unknown): boolean {
  if (status === 429) return true;
  if (typeof body !== "object" || body === null) return false;

  // body.code === "RATE_LIMIT_EXCEEDED"
  if (hasRateLimitCode(body)) return true;

  // body.error?.code === "RATE_LIMIT_EXCEEDED"
  const error = (body as { error?: unknown }).error;
  if (hasRateLimitCode(error)) return true;

  return false;
}
