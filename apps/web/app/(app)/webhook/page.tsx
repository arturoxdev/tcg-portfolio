import { getWebhookOverview } from "@/lib/queries";
import { WebhookView } from "@/components/webhook/webhook-view";

// Lee SQLite en cada request: evita prerender estático y garantiza datos frescos.
export const dynamic = "force-dynamic";

export default async function WebhookPage() {
  const { runs, summary } = await getWebhookOverview();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Webhook
        </h1>
        <p className="text-sm text-muted-foreground">
          Resumen de cada actualización de precios: cómo se disparó (cron diario
          o manual), cuántas cartas se actualizaron y cuántas fallaron.
        </p>
      </div>

      <WebhookView runs={runs} summary={summary} />
    </div>
  );
}
