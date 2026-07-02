import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * Puerta de entrada: toda petición que llega aquí exige una sesión válida.
 * Si no hay JWT (o es inválido/expirado), redirige a /login conservando el
 * destino original en `?next=` para volver tras autenticar.
 *
 * Qué NO pasa por aquí (ver `config.matcher`):
 *  - /login              → la propia pantalla de candado.
 *  - /api/auth/*         → endpoints de login/logout (aún sin sesión).
 *  - /api/cron/*         → lo protege CRON_SECRET, no la sesión de usuario;
 *                          si lo bloqueáramos, el cron de Vercel se rompería.
 *  - assets estáticos    → _next, favicon, etc.
 */
export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const valid = token ? await verifySessionToken(token) : false;

  if (valid) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  // Sólo recordamos el destino para navegaciones de página (no APIs).
  const dest = req.nextUrl.pathname + req.nextUrl.search;
  if (!dest.startsWith("/api/")) {
    loginUrl.searchParams.set("next", dest);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Todo EXCEPTO login, api/auth, api/cron y assets estáticos.
    "/((?!login|api/auth|api/cron|_next/static|_next/image|favicon.ico).*)",
  ],
};
