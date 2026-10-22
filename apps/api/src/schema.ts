import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

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

export const visits = pgTable(
  "visits",
  {
    accountId: text("account_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    dishes: text("dishes").array().notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    lovedIt: boolean("loved_it").notNull(),
    rating: real("rating"),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    review: text("review"),
    revisit: boolean("revisit").notNull(),
    tags: text("tags").array().notNull(),
    visitedOn: date("visited_on", { mode: "string" }).notNull(),
  },
  (table) => [
    check(
      "visits_half_star_rating",
      sql`${table.rating} between 0.5 and 5 and ${table.rating} * 2 = floor(${table.rating} * 2)`
    ),
    index("visits_diary").on(
      table.accountId,
      table.visitedOn.desc(),
      table.createdAt.desc()
    ),
  ]
);

export const reviewLikes = pgTable(
  "review_likes",
  {
    accountId: text("account_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    visitId: uuid("visit_id")
      .notNull()
      .references(() => visits.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.visitId, table.accountId] })]
);
