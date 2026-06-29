# TCG Portfolio

Tracker de portafolio de cartas TCG al estilo CoinMarketCap. Registra las cartas
que tienes (compradas o salidas de sobre), actualiza sus precios de mercado desde
la [TCG API](https://api.tcgapi.dev) y sigue de un vistazo cuánto invertiste, cuánto
vale tu colección hoy y su P&L. Pensado como herramienta single-user en local.

## Stack

- **Next.js 16** (App Router, React 19, Turbopack)
- **Drizzle ORM + SQLite** (`better-sqlite3`, módulo nativo)
- **shadcn/ui** (tema slate, base-nova sobre `@base-ui/react`) + **Tailwind v4**
- **recharts v3** para las gráficas de historial
- Monorepo **Turbo** (npm workspaces): `apps/web` (la app) y `packages/ui`
  (componentes compartidos), más `packages/{eslint-config,typescript-config}`.

## Setup

```bash
# 1. Instalar dependencias (desde la raíz del monorepo)
npm install

# 2. Configurar variables de entorno de la app web
cp apps/web/.env.example apps/web/.env
```

Edita `apps/web/.env` y pon tu `TCG_API_KEY` (obtén la key en
<https://api.tcgapi.dev>). `DATABASE_PATH` ya trae un default
(`./data/tcg-portfolio.db`, relativo al cwd de `apps/web`) y no hace falta tocarlo.

```dotenv
TCG_API_KEY=tu_api_key_aqui
DATABASE_PATH=./data/tcg-portfolio.db
```

## Base de datos

La DB SQLite se crea en `apps/web/data/`. El repo ya incluye una DB migrada y
vacía, pero si necesitas recrearla o aplicar migraciones nuevas:

```bash
cd apps/web
npx drizzle-kit migrate   # aplica las migraciones de db/migrations
```

Scripts de Drizzle disponibles (desde `apps/web`):

| Script              | Qué hace                                              |
| ------------------- | ---------------------------------------------------- |
| `npm run db:generate` | Genera migraciones SQL a partir de `db/schema.ts`. |
| `npm run db:migrate`  | Aplica las migraciones pendientes.                 |
| `npm run db:push`     | Sincroniza el esquema directo a la DB (sin migrar). |
| `npm run db:studio`   | Abre Drizzle Studio para inspeccionar los datos.   |

> Si el hook RTK interfiere con `npm run`, ejecuta el binario directo, p.ej.
> `npx drizzle-kit migrate`.

Tablas: `holdings` (un registro por lote/compra), `price_updates` (un evento por
"Update prices", con el tipo de cambio usado y los totales) y `holding_prices`
(precio de cada carta en cada update).

## Desarrollo

```bash
# Opción A: desde la raíz, vía Turbo
npm run dev

# Opción B: directamente la app web
cd apps/web && npx next dev
```

La app queda en <http://localhost:3000>.

> **Nota sobre RTK**: el hook RTK reescribe `npm run ...`. Si te da problemas,
> usa los binarios directos: `./node_modules/.bin/turbo dev`, o desde `apps/web`
> `npx next dev` / `npx next build`.

## Build

```bash
cd apps/web && npx next build
```

La app declara `serverExternalPackages: ["better-sqlite3"]` (módulo nativo) y las
páginas que leen la DB (`/`, `/holdings`, `/history`) son `dynamic = "force-dynamic"`
para evitar prerender estático y servir siempre datos frescos.

## Uso de la app

- **Dashboard** (`/`): resumen de la colección — costo invertido, valor de
  mercado actual y P&L total, con la fecha y el tipo de cambio del último update.
- **Buscar** (`/search`): busca cartas en vivo contra la TCG API (por juego/set y
  texto) y agrégalas a tu portafolio.
- **Mis cartas** (`/holdings`): tabla/galería de tus posiciones con su P&L
  individual; permite editar y borrar cada carta.
- **Historial** (`/history`): gráfica (recharts) de la evolución del valor y del
  costo de la colección en MXN, un punto por cada update de precios.

### Flujo de "Update prices"

El botón **Update prices** pide un **tipo de cambio MXN/USD manual** (se recuerda
en `localStorage`), consulta el precio de mercado de cada carta de forma
**secuencial con throttle** (~350 ms entre llamadas para respetar la API) y
**genera un snapshot** (`price_updates` + `holding_prices`) que alimenta el
dashboard y el historial.

### Comprada vs. de sobre

Cada carta se marca como **comprada** (con costo base en MXN → se calcula **ROI**)
o **de sobre** (sin costo → se reporta solo el **valor encontrado**). Esto separa
limpiamente lo que invertiste de lo que apareció "gratis".

### Alerta ±10%

Las posiciones (y el total) cuyo P&L supera **±10%** se resaltan visualmente para
detectar de un vistazo subidas o caídas relevantes.

## Notas y limitaciones

- **Rate limit de la API** (~100 peticiones/día): la **búsqueda en vivo consume
  cuota**. Úsala con criterio.
- **Update prices es secuencial** (con throttle), así que con muchas cartas puede
  tardar; está diseñado así para no agotar el límite ni saturar la API.
- **SQLite requiere filesystem persistente**: no funciona en entornos serverless
  efímeros. Pensado para correr en local o en un host con disco persistente.
- **Single-user, sin autenticación**: no hay login ni multiusuario.
- El tipo de cambio MXN/USD es **manual** (lo introduces en cada update); no se
  obtiene de ninguna fuente automática.
</content>
</invoke>
