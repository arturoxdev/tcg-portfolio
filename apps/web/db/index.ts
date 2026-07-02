// SERVER ONLY — nunca importar desde componentes cliente.
// Este módulo abre una conexión libSQL (Turso) sobre red. No usa filesystem ni
// módulos nativos, así que corre en entornos serverless (Vercel).
// No añadir "use client"; consumir únicamente desde Server Components,
// Route Handlers o Server Actions.
//
// ⚠️ El cliente libSQL es ASÍNCRONO: todas las llamadas a la DB
// (.get()/.all()/.run()/.transaction()) devuelven Promises y deben `await`-earse.
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

/**
 * Credenciales de Turso desde el entorno (leídas PEREZOSAMENTE, no al importar):
 *  - TURSO_DATABASE_URL: la URL libsql://… (no es secreta).
 *  - TURSO_AUTH_TOKEN:   token de acceso (secreto; en .env / Vercel env).
 *
 * ⚠️ La conexión se crea en el PRIMER uso, no al importar el módulo. Esto es
 * clave para el build de Vercel/Turbo: la fase "collect page data" importa las
 * rutas (que son force-dynamic y no se ejecutan en build) y NO debe requerir
 * credenciales de DB. Si conectáramos al importar, el build tronaría sin las
 * vars. En runtime, Vercel sí inyecta las env vars y la conexión funciona.
 */
function createConnection() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta TURSO_DATABASE_URL en el entorno (apps/web/.env). " +
        "Obtenla con `turso db show <db> --url`.",
    );
  }
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return drizzle(client, { schema });
}

type DbClient = ReturnType<typeof createConnection>;

/**
 * Singleton vía globalThis para sobrevivir HMR en dev y no abrir
 * múltiples clientes / conexiones.
 */
const globalForDb = globalThis as unknown as { __tcgDb?: DbClient };

function getDb(): DbClient {
  if (!globalForDb.__tcgDb) {
    globalForDb.__tcgDb = createConnection();
  }
  return globalForDb.__tcgDb;
}

/**
 * `db` es un Proxy que difiere la conexión al primer acceso a una propiedad
 * (p.ej. `db.select(...)`). La API pública es idéntica a un cliente drizzle,
 * así que los llamadores no cambian.
 */
export const db = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
}) as DbClient;

export * from "./schema";
