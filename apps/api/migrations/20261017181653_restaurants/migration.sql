CREATE TABLE "restaurants" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"place_id" text UNIQUE,
	"source" text NOT NULL,
	CONSTRAINT "restaurants_provider_has_place" CHECK ("source" = 'provider' and "place_id" is not null)
);
