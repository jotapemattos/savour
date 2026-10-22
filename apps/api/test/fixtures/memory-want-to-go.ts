import { WantToGo } from "@savour/core";
import { Effect, Layer } from "effect";

interface SavedRestaurant {
  readonly accountId: string;
  readonly restaurantId: string;
}

const MEMORY_RESTAURANT_PREFIX = /^restaurant-/u;

export const MemoryWantToGo = Layer.sync(WantToGo, () => {
  const saved: SavedRestaurant[] = [];

  const indexOf = (accountId: string, restaurantId: string) =>
    saved.findIndex(
      (entry) =>
        entry.accountId === accountId && entry.restaurantId === restaurantId
    );

  return WantToGo.of({
    add: (accountId, restaurantId) =>
      Effect.sync(() => {
        if (indexOf(accountId, restaurantId) === -1) {
          saved.unshift({ accountId, restaurantId });
        }
      }),
    list: (accountId) =>
      Effect.sync(() =>
        saved.flatMap((entry) =>
          entry.accountId === accountId
            ? [
                {
                  id: entry.restaurantId,
                  placeId: entry.restaurantId.replace(
                    MEMORY_RESTAURANT_PREFIX,
                    ""
                  ),
                  source: "provider" as const,
                },
              ]
            : []
        )
      ),
    remove: (accountId, restaurantId) =>
      Effect.sync(() => {
        const index = indexOf(accountId, restaurantId);

        if (index !== -1) {
          saved.splice(index, 1);
        }
      }),
  });
});
