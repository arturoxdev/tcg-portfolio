ALTER TABLE `price_updates` ADD `trigger_source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `price_updates` ADD `failed_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `price_updates` ADD `rate_limited` integer DEFAULT false NOT NULL;