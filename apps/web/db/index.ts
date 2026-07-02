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
 * Credenciales de Turso desde el entorno:
 *  - TURSO_DATABASE_URL: la URL libsql://… (no es secreta).
 *  - TURSO_AUTH_TOKEN:   token de acceso (secreto; en .env / Vercel env).
 *
 * En dev local se puede apuntar a un archivo con file:./data/tcg-portfolio.db,
 * pero por defecto exigimos la URL remota para no divergir de producción.
 */
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  throw new Error(
    "Falta TURSO_DATABASE_URL en el entorno (apps/web/.env). " +
      "Obtenla con `turso db show <db> --url`.",
  );
}

function createConnection() {
  const client = createClient({ url: url!, authToken });
  return drizzle(client, { schema });
}

/**
 * Singleton vía globalThis para sobrevivir HMR en dev y no abrir
 * múltiples clientes / conexiones.
 */
const globalForDb = globalThis as unknown as {
  __tcgDb?: ReturnType<typeof createConnection>;
};

export const db = globalForDb.__tcgDb ?? createConnection();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__tcgDb = db;
}

export * from "./schema";
