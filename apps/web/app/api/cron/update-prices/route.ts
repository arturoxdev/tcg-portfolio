import { NextResponse, type NextRequest } from "next/server";

import { runPriceUpdate } from "@/lib/actions";

// Corre en el runtime Node (el cliente libSQL usa APIs de Node), nunca prerender,
// y reserva el presupuesto máximo de duración del plan Hobby (60s). El job real
// (fetch secuencial con throttle) tarda decenas de segundos y cabe de sobra.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/update-prices
 *
 * Endpoint que dispara Vercel Cron (1×/día) para actualizar los precios de todo
 * el portafolio y generar un snapshot. Reutiliza `runPriceUpdate()` sin argumento,
 * que toma el **tipo de cambio guardado en Settings** (no hay quién lo teclee en
 * un cron), así que asegúrate de haber guardado un FX al menos una vez.
 *
 * Seguridad: Vercel añade `Authorization: Bearer $CRON_SECRET` a las invocaciones
 * de cron cuando la env var CRON_SECRET está configurada. Rechazamos cualquier
 * request que no traiga ese header para que nadie más pueda dispararlo.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;

  // Sin CRON_SECRET configurado no autenticamos nada: mejor fallar cerrado.
  if (!secret) {
    console.error("[cron/update-prices] CRON_SECRET no está configurado.");
    return NextResponse.json(
      { error: "CRON_SECRET no configurado en el entorno." },
      { status: 500 },
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const result = await runPriceUpdate(undefined, { trigger: "cron" });
    console.log(
      `[cron/update-prices] ok: ${result.updated} actualizadas, ` +
        `${result.failed.length} fallidas` +
        (result.rateLimited ? " (detenido por 429)" : ""),
    );
    return NextResponse.json({
      ok: true,
      updateId: result.updateId,
      updated: result.updated,
      failed: result.failed.length,
      rateLimited: result.rateLimited,
      fxRate: result.fxRate,
      totals: result.totals,
    });
  } catch (err) {
    // El caso típico: aún no se ha guardado un tipo de cambio en Settings.
    const message =
      err instanceof Error ? err.message : "Error desconocido en el cron.";
    console.error("[cron/update-prices] error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
