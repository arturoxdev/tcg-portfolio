import { sql, relations } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
} from "drizzle-orm/sqlite-core";

/**
 * Acquisition type union — exported for use in server actions / forms.
 */
export const ACQUISITION_TYPES = ["comprada", "de_sobre"] as const;
export type AcquisitionType = (typeof ACQUISITION_TYPES)[number];

/**
 * `holdings` — un registro por lote/compra.
 */
export const holdings = sqliteTable("holdings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // ID de la TCG API
  cardId: integer("card_id"),
  tcgplayerId: integer("tcgplayer_id"),

  // Variante exacta (ej. "Holofoil")
  printing: text("printing").notNull(),

  // ['comprada','de_sobre']
  acquisitionType: text("acquisition_type", {
    enum: ACQUISITION_TYPES,
  }).notNull(),

  // null si de_sobre
  costBasisMxn: real("cost_basis_mxn"),

  // ISO 'YYYY-MM-DD'
  purchaseDate: text("purchase_date"),

  notes: text("notes"),

  // metadata cacheada
  name: text("name"),
  setName: text("set_name"),
  gameName: text("game_name"),
  gameSlug: text("game_slug"),
  rarity: text("rarity"),
  number: text("number"),
  imageUrl: text("image_url"),

  // denormalizado — último valor de mercado
  lastMarketMxn: real("last_market_mxn"),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * `price_updates` — un evento por "Update prices".
 */
export const priceUpdates = sqliteTable("price_updates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),

  // MXN por USD
  fxRate: real("fx_rate").notNull(),

  totalCostMxn: real("total_cost_mxn"),
  totalValueMxn: real("total_value_mxn"),
  totalPnlMxn: real("total_pnl_mxn"),
  totalPnlPct: real("total_pnl_pct"),
  cardCount: integer("card_count"),
});

/**
 * `holding_prices` — precio de cada carta en un update.
 */
export const holdingPrices = sqliteTable("holding_prices", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  updateId: text("update_id")
    .notNull()
    .references(() => priceUpdates.id, { onDelete: "cascade" }),
  holdingId: text("holding_id")
    .notNull()
    .references(() => holdings.id, { onDelete: "cascade" }),

  marketPriceUsd: real("market_price_usd"),
  marketPriceMxn: real("market_price_mxn"),
  lowPriceUsd: real("low_price_usd"),
  medianPriceUsd: real("median_price_usd"),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * `settings` — almacén key-value para configuración persistente
 * (p.ej. el tipo de cambio FX por defecto).
 */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Relations.
 * holdings 1—* holdingPrices
 * priceUpdates 1—* holdingPrices
 */
export const holdingsRelations = relations(holdings, ({ many }) => ({
  prices: many(holdingPrices),
}));

export const priceUpdatesRelations = relations(priceUpdates, ({ many }) => ({
  prices: many(holdingPrices),
}));

export const holdingPricesRelations = relations(holdingPrices, ({ one }) => ({
  update: one(priceUpdates, {
    fields: [holdingPrices.updateId],
    references: [priceUpdates.id],
  }),
  holding: one(holdings, {
    fields: [holdingPrices.holdingId],
    references: [holdings.id],
  }),
}));

/**
 * Inferred types.
 */
export type Holding = typeof holdings.$inferSelect;
export type NewHolding = typeof holdings.$inferInsert;

export type PriceUpdate = typeof priceUpdates.$inferSelect;
export type NewPriceUpdate = typeof priceUpdates.$inferInsert;

export type HoldingPrice = typeof holdingPrices.$inferSelect;
export type NewHoldingPrice = typeof holdingPrices.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
