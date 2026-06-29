"use client";

import * as React from "react";
import Link from "next/link";
import { SearchIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardFooter,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Slider } from "@workspace/ui/components/slider";

import {
  isRateLimited,
  RATE_LIMIT_DESCRIPTION,
  RATE_LIMIT_TITLE,
} from "@/lib/api-error";
import { formatMxn, formatUsd } from "@/lib/format";
import type {
  TcgGame,
  TcgRateLimit,
  TcgSearchItem,
  TcgSet,
} from "@/lib/tcg-types";

import { AddCardDialog } from "@/components/search/add-card-dialog";

const PER_PAGE = 24;
const DEBOUNCE_MS = 400;
const MIN_QUERY = 2;
const PRICE_MIN = 0;
const PRICE_MAX = 1000;
const PRICE_STEP = 5;

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevancia" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
  { value: "name", label: "Nombre" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

// Valor sentinela para la opción "Todos" en Selects (base-ui no admite "" como value).
const ALL = "__all__";

type SearchViewProps = {
  games: TcgGame[];
  /** Tipo de cambio (MXN por USD) configurado en Settings; null si no existe. */
  fxRate: number | null;
};

export function SearchView({ games, fxRate }: SearchViewProps) {
  // --- Filtros ---
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [game, setGame] = React.useState<string>(ALL); // slug del juego o ALL
  const [setId, setSetId] = React.useState<string>(ALL); // id del set (string) o ALL
  const [rarity, setRarity] = React.useState("");
  const [type, setType] = React.useState<string>(ALL); // Cards / Sealed Products / ALL
  const [sort, setSort] = React.useState<SortValue>("relevance");
  const [priceRange, setPriceRange] = React.useState<readonly number[]>([
    PRICE_MIN,
    PRICE_MAX,
  ]);

  // --- Sets dependientes del juego ---
  const [sets, setSets] = React.useState<TcgSet[]>([]);
  const [setsLoading, setSetsLoading] = React.useState(false);

  // --- Resultados ---
  const [results, setResults] = React.useState<TcgSearchItem[]>([]);
  const [hasMore, setHasMore] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rateLimit, setRateLimit] = React.useState<TcgRateLimit | null>(null);
  // Banner persistente cuando la TCG API responde 429 (límite diario).
  const [rateLimited, setRateLimited] = React.useState(false);
  const [searched, setSearched] = React.useState(false);

  // --- Diálogo de alta ---
  const [selectedItem, setSelectedItem] = React.useState<TcgSearchItem | null>(
    null,
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // Debounce del texto de búsqueda.
  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [q]);

  // Cualquier cambio de filtro (excepto page) vuelve a la página 1.
  const resetPage = React.useCallback(() => setPage(1), []);

  // Carga de sets al cambiar el juego.
  React.useEffect(() => {
    if (game === ALL) {
      setSets([]);
      setSetId(ALL);
      return;
    }
    const controller = new AbortController();
    setSetsLoading(true);
    setSetId(ALL);
    fetch(`/api/games/${encodeURIComponent(game)}/sets?per_page=200`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = (await res.json()) as
          | { data: TcgSet[] }
          | { error: unknown };
        if (!res.ok || "error" in json) throw new Error("sets");
        setSets(json.data ?? []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSets([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSetsLoading(false);
      });
    return () => controller.abort();
  }, [game]);

  // Búsqueda: se dispara con q (debounced), filtros y page.
  const minPrice = priceRange[0] ?? PRICE_MIN;
  const maxPrice = priceRange[1] ?? PRICE_MAX;

  React.useEffect(() => {
    if (debouncedQ.length < MIN_QUERY) {
      setResults([]);
      setHasMore(false);
      setError(null);
      setRateLimited(false);
      setSearched(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setRateLimited(false);
    setSearched(true);

    const params = new URLSearchParams();
    params.set("q", debouncedQ);
    if (game !== ALL) params.set("game", game);
    if (setId !== ALL) params.set("set_id", setId);
    if (rarity.trim()) params.set("rarity", rarity.trim());
    if (type !== ALL) params.set("type", type);
    if (minPrice > PRICE_MIN) params.set("min_price", String(minPrice));
    if (maxPrice < PRICE_MAX) params.set("max_price", String(maxPrice));
    if (sort !== "relevance") params.set("sort", sort);
    params.set("page", String(page));
    params.set("per_page", String(PER_PAGE));

    fetch(`/api/search?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = (await res.json()) as {
          data?: TcgSearchItem[];
          meta?: { has_more?: boolean };
          rate_limit?: TcgRateLimit;
          error?: unknown;
          code?: unknown;
        };
        if (!res.ok) {
          // Límite diario de la TCG API (429): banner persistente + toast,
          // sin tratarlo como el error genérico de búsqueda.
          if (isRateLimited(res.status, json)) {
            setResults([]);
            setHasMore(false);
            setRateLimited(true);
            toast.error(RATE_LIMIT_TITLE, {
              description: RATE_LIMIT_DESCRIPTION,
            });
            return;
          }
          const msg =
            typeof json.error === "string"
              ? json.error
              : "No se pudo completar la búsqueda.";
          throw new Error(msg);
        }
        setResults(json.data ?? []);
        setHasMore(Boolean(json.meta?.has_more));
        setRateLimit(json.rate_limit ?? null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setResults([]);
        setHasMore(false);
        setError(
          err instanceof Error ? err.message : "Error al buscar cartas.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQ, game, setId, rarity, type, minPrice, maxPrice, sort, page]);

  function openAdd(item: TcgSearchItem) {
    setSelectedItem(item);
    setDialogOpen(true);
  }

  const showEmpty =
    !loading && !error && !rateLimited && searched && results.length === 0;
  const showPrompt = debouncedQ.length < MIN_QUERY && !loading;

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de búsqueda */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            resetPage();
          }}
          placeholder="Buscar por nombre de carta… (mín. 2 caracteres)"
          className="h-9 pl-8"
          aria-label="Buscar cartas"
        />
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Juego */}
        <div className="grid gap-1.5">
          <Label htmlFor="filter-game">Juego</Label>
          <Select
            value={game}
            onValueChange={(value) => {
              setGame(value as string);
              resetPage();
            }}
          >
            <SelectTrigger id="filter-game" className="w-full">
              {/* base-ui muestra el `value` crudo: mapeamos a nombre legible. */}
              <SelectValue>
                {(value) =>
                  value == null || value === ALL
                    ? "Todos los juegos"
                    : (games.find((g) => g.slug === value)?.name ??
                      "Todos los juegos")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los juegos</SelectItem>
              {games.map((g) => (
                <SelectItem key={g.slug} value={g.slug}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Set (dependiente del juego) */}
        <div className="grid gap-1.5">
          <Label htmlFor="filter-set">Set</Label>
          <Select
            value={setId}
            onValueChange={(value) => {
              setSetId(value as string);
              resetPage();
            }}
            disabled={game === ALL || setsLoading}
          >
            <SelectTrigger id="filter-set" className="w-full">
              <SelectValue>
                {(value) => {
                  if (game === ALL) return "Elige un juego";
                  if (setsLoading) return "Cargando…";
                  if (value == null || value === ALL) return "Todos los sets";
                  return (
                    sets.find((s) => String(s.id) === value)?.name ??
                    "Todos los sets"
                  );
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los sets</SelectItem>
              {sets.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Rareza (texto libre) */}
        <div className="grid gap-1.5">
          <Label htmlFor="filter-rarity">Rareza</Label>
          <Input
            id="filter-rarity"
            value={rarity}
            onChange={(e) => {
              setRarity(e.target.value);
              resetPage();
            }}
            placeholder="Ej. Rare, Mythic…"
          />
        </div>

        {/* Tipo de producto */}
        <div className="grid gap-1.5">
          <Label htmlFor="filter-type">Tipo</Label>
          <Select
            value={type}
            onValueChange={(value) => {
              setType(value as string);
              resetPage();
            }}
          >
            <SelectTrigger id="filter-type" className="w-full">
              <SelectValue>
                {(value) =>
                  value === "Cards"
                    ? "Cartas"
                    : value === "Sealed Products"
                      ? "Sellados"
                      : "Todos"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              <SelectItem value="Cards">Cartas</SelectItem>
              <SelectItem value="Sealed Products">Sellados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Rango de precio */}
        <div className="grid gap-1.5 sm:col-span-2">
          <Label>
            Precio (USD): {formatUsd(minPrice)} –{" "}
            {maxPrice >= PRICE_MAX ? `${formatUsd(PRICE_MAX)}+` : formatUsd(maxPrice)}
          </Label>
          <Slider
            value={priceRange}
            onValueChange={(value) =>
              setPriceRange(Array.isArray(value) ? value : [value])
            }
            onValueCommitted={resetPage}
            min={PRICE_MIN}
            max={PRICE_MAX}
            step={PRICE_STEP}
            className="py-2"
            aria-label="Rango de precio"
          />
        </div>

        {/* Orden */}
        <div className="grid gap-1.5 sm:col-span-2 lg:col-span-2">
          <Label htmlFor="filter-sort">Ordenar por</Label>
          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value as SortValue);
              resetPage();
            }}
          >
            <SelectTrigger id="filter-sort" className="w-full">
              <SelectValue>
                {(value) =>
                  SORT_OPTIONS.find((o) => o.value === value)?.label ??
                  "Relevancia"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Banner persistente de límite diario alcanzado (429). */}
      {rateLimited && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400"
        >
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-medium">{RATE_LIMIT_TITLE}</p>
            <p className="text-amber-700/90 dark:text-amber-400/90">
              {RATE_LIMIT_DESCRIPTION}
            </p>
          </div>
        </div>
      )}

      {/* Rate limit (discreto) */}
      {rateLimit != null && (
        <p className="text-xs text-muted-foreground">
          Te quedan {rateLimit.daily_remaining} consultas hoy.
        </p>
      )}

      {/* Resultados */}
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <ResultsSkeleton />
      ) : showPrompt ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Escribe al menos {MIN_QUERY} caracteres para buscar.
        </p>
      ) : showEmpty ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Sin resultados. Prueba con otro término o ajusta los filtros.
        </p>
      ) : rateLimited ? null : (
        <>
          {/* Aviso: sin tipo de cambio, los precios se muestran en USD. */}
          {fxRate == null && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              <span>
                Configura el tipo de cambio en Settings para ver los precios en
                pesos.
              </span>
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/settings">Ir a Settings</Link>}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {results.map((item) => (
              <ResultCard
                key={item.id}
                item={item}
                fxRate={fxRate}
                onAdd={openAdd}
              />
            ))}
          </div>
        </>
      )}

      {/* Paginación */}
      {!error && searched && results.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">Página {page}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasMore || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      <AddCardDialog
        item={selectedItem}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        fxRate={fxRate}
      />
    </div>
  );
}

function ResultCard({
  item,
  fxRate,
  onAdd,
}: {
  item: TcgSearchItem;
  fxRate: number | null;
  onAdd: (item: TcgSearchItem) => void;
}) {
  // Si hay FX válido y precio, mostramos MXN como principal y USD secundario.
  const showMxn = fxRate != null && fxRate > 0 && item.market_price != null;
  return (
    <Card size="sm" className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-2">
        <div className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-md bg-muted">
          {item.image_url ? (
            // URLs externas: <img> normal (no next/image sin dominios configurados).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image_url}
              alt={item.name}
              loading="lazy"
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-xs text-muted-foreground">Sin imagen</span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <p className="line-clamp-2 font-medium leading-snug" title={item.name}>
            {item.name}
          </p>
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {item.set_name}
          </p>
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {item.game_name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {item.rarity && (
              <Badge variant="secondary" className="capitalize">
                {item.rarity}
              </Badge>
            )}
            {item.printing && (
              <Badge variant="outline">{item.printing}</Badge>
            )}
          </div>
          <div className="mt-auto pt-1">
            {showMxn ? (
              <>
                <p className="text-sm font-semibold tabular-nums">
                  {formatMxn(item.market_price! * fxRate!)}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatUsd(item.market_price)}
                </p>
              </>
            ) : (
              <p className="text-sm font-semibold tabular-nums">
                {formatUsd(item.market_price)}
              </p>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-3">
        <Button
          size="sm"
          className="w-full"
          onClick={() => onAdd(item)}
        >
          Agregar
        </Button>
      </CardFooter>
    </Card>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <Card key={i} size="sm" className="flex h-full flex-col">
          <CardContent className="flex flex-col gap-2">
            <Skeleton className="aspect-[3/4] w-full rounded-md" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
          </CardContent>
          <CardFooter className="p-3">
            <Skeleton className="h-7 w-full" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export default SearchView;
