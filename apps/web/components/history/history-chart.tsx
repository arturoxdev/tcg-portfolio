"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "@/components/history/recharts";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group";

import type { HistoryPoint } from "@/lib/queries";
import { formatDate, formatMxn } from "@/lib/format";
import { PnlBadge } from "@/components/pnl-badge";

/** Modos del toggle: qué serie(s) mostrar. */
type Mode = "valor" | "costo" | "ambos";

const chartConfig = {
  valor: {
    label: "Valor de mercado",
    color: "var(--chart-1)",
  },
  costo: {
    label: "Costo invertido",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

/** Formato compacto de MXN para los ticks del eje Y (ej. "$1.2k", "$3.4M"). */
const compactMxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  notation: "compact",
  maximumFractionDigits: 1,
});

type ChartDatum = {
  fecha: number;
  valor: number | null;
  costo: number | null;
};

export function HistoryChart({ data }: { data: HistoryPoint[] }) {
  const [mode, setMode] = React.useState<Mode>("valor");

  const chartData = React.useMemo<ChartDatum[]>(
    () =>
      data.map((p) => ({
        fecha: p.createdAt,
        valor: p.totalValueMxn,
        costo: p.totalCostMxn,
      })),
    [data],
  );

  const showValor = mode === "valor" || mode === "ambos";
  const showCosto = mode === "costo" || mode === "ambos";

  const last = data[data.length - 1];
  const singlePoint = data.length === 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Valor del portafolio</CardTitle>
        <CardDescription>
          {last ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-mono tabular-nums text-foreground">
                {formatMxn(last.totalValueMxn)}
              </span>
              <PnlBadge
                pnlPct={last.totalPnlPct}
                pnlMxn={last.totalPnlMxn}
                size="sm"
              />
            </span>
          ) : (
            "Evolución por snapshot"
          )}
        </CardDescription>
        <CardAction>
          <ToggleGroup
            value={[mode]}
            onValueChange={(value) => {
              const next = value[0] as Mode | undefined;
              if (next) setMode(next);
            }}
            variant="outline"
            size="sm"
            aria-label="Series a mostrar"
          >
            <ToggleGroupItem value="valor" aria-label="Valor de mercado">
              Valor
            </ToggleGroupItem>
            <ToggleGroupItem value="costo" aria-label="Costo invertido">
              Costo
            </ToggleGroupItem>
            <ToggleGroupItem value="ambos" aria-label="Ambas series">
              Ambos
            </ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent>
        {singlePoint && (
          <p className="mb-2 text-xs text-muted-foreground">
            Se necesita más de un snapshot para ver la tendencia.
          </p>
        )}
        <ChartContainer
          config={chartConfig}
          className="h-[300px] w-full md:h-[400px]"
        >
          <LineChart data={chartData} margin={{ left: 12, right: 12, top: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="fecha"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={(value: number) => formatDate(value)}
            />
            <YAxis
              width={64}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value: number) => compactMxn.format(value)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatDate(value as number)}
                  formatter={(itemValue, name, item) => (
                    <div className="flex w-full items-center justify-between gap-3 leading-none">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                          style={{ backgroundColor: item.color }}
                        />
                        {chartConfig[name as keyof typeof chartConfig]?.label ??
                          name}
                      </span>
                      <span className="font-mono font-medium text-foreground tabular-nums">
                        {formatMxn(itemValue as number)}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {showValor && (
              <Line
                dataKey="valor"
                name="valor"
                type="monotone"
                stroke="var(--color-valor)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
              />
            )}
            {showCosto && (
              <Line
                dataKey="costo"
                name="costo"
                type="monotone"
                stroke="var(--color-costo)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
              />
            )}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export default HistoryChart;
