// Autenticación single-user, STATELESS, basada en JWT.
//
// Diseño:
//  - Usuario y contraseña viven en variables de entorno (AUTH_USERNAME /
//    AUTH_PASSWORD). No hay registro ni base de usuarios.
//  - Al entrar se firma un JWT (HS256) con AUTH_SECRET y se guarda en una
//    cookie httpOnly. No se persiste nada en servidor: la sesión ES el token.
//
// EDGE-SAFE: sólo usa `jose`, Web Crypto y TextEncoder — nada de APIs de Node —
// para poder ejecutarse dentro de `middleware.ts` (runtime edge). La lectura de
// credenciales (verifyCredentials) sólo la invoca el route handler de login.

import { SignJWT, jwtVerify } from "jose";

/** Nombre de la cookie que guarda el JWT de sesión. */
export const SESSION_COOKIE = "tcg_session";

/** Vida del token / cookie (30 días). */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const ALG = "HS256";

/** Clave de firma derivada de AUTH_SECRET. Lanza si falta o es muy corta. */
function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET no configurado o demasiado corto (mín. 16 chars). " +
        "Genera uno con `openssl rand -hex 32`.",
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Comparación de strings en tiempo (aproximadamente) constante para no filtrar
 * información por timing al validar credenciales. Recorre SIEMPRE el largo
 * máximo y acumula diferencias con XOR.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Valida usuario+contraseña contra AUTH_USERNAME/AUTH_PASSWORD del entorno.
 * Evalúa ambos campos SIEMPRE (no corta al primer fallo) para no filtrar cuál
 * de los dos estuvo mal. Sólo se llama desde el route handler de login (Node).
 */
export function verifyCredentials(username: string, password: string): boolean {
  const u = process.env.AUTH_USERNAME;
  const p = process.env.AUTH_PASSWORD;
  if (!u || !p) {
    throw new Error(
      "AUTH_USERNAME / AUTH_PASSWORD no configurados en el entorno.",
    );
  }
  const okUser = timingSafeEqual(username, u);
  const okPass = timingSafeEqual(password, p);
  return okUser && okPass;
}

/** Firma un JWT de sesión para `username`. */
export async function createSessionToken(username: string): Promise<string> {
  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

/**
 * Verifica un JWT de sesión. Devuelve true si la firma y el `exp` son válidos.
 * Nunca lanza: cualquier fallo (expirado, firma inválida, malformado) → false.
 */
export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secretKey(), { algorithms: [ALG] });
    return true;
  } catch {
    return false;
  }
}
