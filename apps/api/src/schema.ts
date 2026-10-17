import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const restaurants = pgTable(
  "restaurants",
  {
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: text("place_id").unique(),
    source: text("source").notNull(),
  },
  (table) => [
    check(
      "restaurants_provider_has_place",
      sql`${table.source} = 'provider' and ${table.placeId} is not null`
    ),
  ]
);
