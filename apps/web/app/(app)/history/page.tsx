import { getHistory } from "@/lib/queries";
import { HistoryChart } from "@/components/history/history-chart";

// Lee SQLite en cada request: evita prerender estático y garantiza datos frescos.
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const history = await getHistory();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Historial
        </h1>
        <p className="text-sm text-muted-foreground">
          Evolución del valor de tu colección en MXN por cada actualización de
          precios.
        </p>
      </div>

      {history.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aún no hay historial. Presiona &quot;Update prices&quot; para crear el
          primer snapshot.
        </div>
      ) : (
        <HistoryChart data={history} />
      )}
    </div>
  );
}
