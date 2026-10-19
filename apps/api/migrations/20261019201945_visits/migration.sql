CREATE TABLE "visits" (
	"account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dishes" text[] NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"loved_it" boolean NOT NULL,
	"rating" real,
	"restaurant_id" uuid NOT NULL,
	"review" text,
	"revisit" boolean NOT NULL,
	"tags" text[] NOT NULL,
	"visited_on" date NOT NULL,
	CONSTRAINT "visits_half_star_rating" CHECK ("rating" between 0.5 and 5 and "rating" * 2 = floor("rating" * 2))
);
--> statement-breakpoint
CREATE INDEX "visits_diary" ON "visits" ("account_id","visited_on" DESC NULLS LAST,"created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_restaurant_id_restaurants_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id");