// SERVER ONLY — nunca importar desde componentes cliente.
// Este módulo abre una conexión better-sqlite3 al filesystem (Node runtime).
// No añadir "use client"; consumir únicamente desde Server Components,
// Route Handlers o Server Actions.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

/**
 * Ruta de la DB desde DATABASE_PATH (relativa al cwd de apps/web).
 * Se resuelve contra process.cwd() de forma estáticamente acotada para que el
 * tracer de Next (NFT) no intente trazar todo el proyecto (warning de Turbopack).
 */
const DB_PATH = process.env.DATABASE_PATH ?? "./data/tcg-portfolio.db";

function createConnection() {
  // Asegura que el directorio padre exista antes de abrir la conexión.
  // Soporta DATABASE_PATH absoluto o relativo al cwd de apps/web.
  const resolvedPath = path.isAbsolute(DB_PATH)
    ? DB_PATH
    : path.join(process.cwd(), DB_PATH);
  const dir = path.dirname(resolvedPath);
  fs.mkdirSync(dir, { recursive: true });

  const sqlite = new Database(resolvedPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return drizzle(sqlite, { schema });
}

/**
 * Singleton vía globalThis para sobrevivir HMR en dev y no abrir
 * múltiples conexiones / file handles.
 */
const globalForDb = globalThis as unknown as {
  __tcgDb?: ReturnType<typeof createConnection>;
};

export const db = globalForDb.__tcgDb ?? createConnection();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__tcgDb = db;
}

export * from "./schema";
