import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const restaurants = pgTable(
  "restaurants",
  {
    addedBy: text("added_by"),
    address: text("address"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    placeId: text("place_id").unique(),
    source: text("source").notNull(),
  },
  (table) => [
    check(
      "restaurants_provider_or_user_added",
      sql`(${table.source} = 'provider' and ${table.placeId} is not null and ${table.name} is null and ${table.address} is null and ${table.addedBy} is null) or (${table.source} = 'user' and ${table.placeId} is null and ${table.name} is not null and ${table.address} is not null and ${table.addedBy} is not null)`
    ),
    index("restaurants_name_trigrams").using(
      "gin",
      table.name.op("gin_trgm_ops")
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
