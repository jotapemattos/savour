CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
ALTER TABLE "restaurants" DROP CONSTRAINT "restaurants_provider_has_place";--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "added_by" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "name" text;--> statement-breakpoint
CREATE INDEX "restaurants_name_trigrams" ON "restaurants" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_provider_or_user_added" CHECK (("source" = 'provider' and "place_id" is not null and "name" is null and "address" is null and "added_by" is null) or ("source" = 'user' and "place_id" is null and "name" is not null and "address" is not null and "added_by" is not null));
