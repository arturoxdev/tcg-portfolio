// Utilidades de formato compartidas (server + client safe). NO usar "use client":
// estas funciones son puras y deben poder importarse desde Server Components,
// Client Components y Server Actions por igual.

const PLACEHOLDER = "—" as const;

function isNullish(n: number | null | undefined): n is null | undefined {
  return n == null || (typeof n === "number" && !Number.isFinite(n));
}

const mxnFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Monto en pesos mexicanos. `null`/`undefined`/no finito → "—". */
export function formatMxn(n: number | null | undefined): string {
  if (isNullish(n)) return PLACEHOLDER;
  return mxnFormatter.format(n);
}

/** Monto en dólares estadounidenses. `null`/`undefined`/no finito → "—". */
export function formatUsd(n: number | null | undefined): string {
  if (isNullish(n)) return PLACEHOLDER;
  return usdFormatter.format(n);
}

export type FormatPctOptions = {
  /** Decimales a mostrar (default 1). */
  digits?: number;
  /** Si `false`, omite el "+" en valores positivos (default true). */
  withSign?: boolean;
};

/**
 * Porcentaje con signo. Recibe el valor YA en puntos porcentuales
 * (ej. `12.3` → "+12.3%", `-4` → "-4.0%"). `null`/`undefined`/no finito → "—".
 */
export function formatPct(
  n: number | null | undefined,
  opts: FormatPctOptions = {},
): string {
  if (isNullish(n)) return PLACEHOLDER;
  const { digits = 1, withSign = true } = opts;
  const fixed = n.toFixed(digits);
  // `toFixed` ya incluye "-" para negativos; sólo agregamos "+" para no-negativos.
  const sign = withSign && n >= 0 ? "+" : "";
  return `${sign}${fixed}%`;
}

/** Normaliza distintas entradas a `Date`; devuelve `null` si es inválida. */
function toDate(d: Date | number | string | null | undefined): Date | null {
  if (d == null) return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Fecha legible es-MX (ej. "7 jun 2026"). `null`/inválida → "—". */
export function formatDate(d: Date | number | string | null | undefined): string {
  const date = toDate(d);
  if (!date) return PLACEHOLDER;
  return dateFormatter.format(date);
}

/** Fecha y hora corta es-MX (ej. "7 jun 2026, 14:30"). `null`/inválida → "—". */
export function formatDateTime(
  d: Date | number | string | null | undefined,
): string {
  const date = toDate(d);
  if (!date) return PLACEHOLDER;
  return dateTimeFormatter.format(date);
}
