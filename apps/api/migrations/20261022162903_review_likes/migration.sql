CREATE TABLE "review_likes" (
	"account_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"visit_id" uuid,
	CONSTRAINT "review_likes_pkey" PRIMARY KEY("visit_id","account_id")
);
--> statement-breakpoint
ALTER TABLE "review_likes" ADD CONSTRAINT "review_likes_visit_id_visits_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE;