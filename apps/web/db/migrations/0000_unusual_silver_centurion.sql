CREATE TABLE `holding_prices` (
	`id` text PRIMARY KEY NOT NULL,
	`update_id` text NOT NULL,
	`holding_id` text NOT NULL,
	`market_price_usd` real,
	`market_price_mxn` real,
	`low_price_usd` real,
	`median_price_usd` real,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`update_id`) REFERENCES `price_updates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`holding_id`) REFERENCES `holdings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `holdings` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` integer,
	`tcgplayer_id` integer,
	`printing` text NOT NULL,
	`acquisition_type` text NOT NULL,
	`cost_basis_mxn` real,
	`purchase_date` text,
	`notes` text,
	`name` text,
	`set_name` text,
	`game_name` text,
	`game_slug` text,
	`rarity` text,
	`number` text,
	`image_url` text,
	`last_market_mxn` real,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `price_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`fx_rate` real NOT NULL,
	`total_cost_mxn` real,
	`total_value_mxn` real,
	`total_pnl_mxn` real,
	`total_pnl_pct` real,
	`card_count` integer
);
