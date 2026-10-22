CREATE TABLE "want_to_go" (
	"account_id" text,
	"restaurant_id" uuid,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "want_to_go_pkey" PRIMARY KEY("account_id","restaurant_id")
);
--> statement-breakpoint
CREATE INDEX "want_to_go_newest" ON "want_to_go" ("account_id","saved_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "want_to_go" ADD CONSTRAINT "want_to_go_restaurant_id_restaurants_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id");