import { NextResponse, type NextRequest } from "next/server";

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  verifyCredentials,
} from "@/lib/auth";

// Firma el JWT en runtime Node (no hay dependencia de Node, pero mantenemos el
// route handler fuera del edge por simplicidad). Nunca prerender.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login
 * Body JSON: { username, password }. Compara contra AUTH_USERNAME/AUTH_PASSWORD
 * del entorno; si coincide, firma un JWT y lo deja en una cookie httpOnly.
 */
export async function POST(req: NextRequest) {
  let username = "";
  let password = "";
  try {
    const body = await req.json();
    username = typeof body?.username === "string" ? body.username : "";
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  let ok = false;
  try {
    ok = verifyCredentials(username, password);
  } catch (err) {
    // Falta configurar AUTH_USERNAME/AUTH_PASSWORD/AUTH_SECRET en el entorno.
    const message =
      err instanceof Error ? err.message : "Error de configuración de auth.";
    console.error("[auth/login] config:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!ok) {
    return NextResponse.json(
      { error: "Usuario o contraseña incorrectos." },
      { status: 401 },
    );
  }

  const token = await createSessionToken(username);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
