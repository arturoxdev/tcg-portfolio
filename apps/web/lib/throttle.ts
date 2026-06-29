// Helpers de throttling para llamadas secuenciales (p.ej. "Update prices").
// Sin I/O ni dependencias: utilidades puras de control de flujo.

/** Espera `ms` milisegundos. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Procesa `items` de forma SECUENCIAL aplicando `fn`, esperando `delayMs`
 * entre llamadas (no antes de la primera ni después de la última).
 *
 * NO traga errores: si `fn` lanza, el error se propaga y se detiene el proceso.
 * La resiliencia (try/catch, reintentos, omitir fallidos) la decide el llamador.
 */
export async function mapSequentialWithThrottle<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  delayMs = 350,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i++) {
    if (i > 0 && delayMs > 0) {
      await sleep(delayMs);
    }
    // `items[i]` está garantizado dentro del rango del bucle.
    results.push(await fn(items[i] as T, i));
  }
  return results;
}
