import type { Place } from "@savour/core/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { Effect } from "effect";

import {
  addToWantToGo,
  removeFromWantToGo,
  wantToGoKey,
  wantToGoQuery,
} from "#/client/want-to-go";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

const BOOKMARK_PATH = "M6 3.5h12v17l-6-4.2-6 4.2z";

const BookmarkGlyph = (props: { readonly saved: boolean }) => (
  <svg
    aria-hidden="true"
    className={cn(
      "stroke-current stroke-[1.5] transition-[fill] duration-150",
      props.saved ? "fill-primary stroke-primary" : "fill-none"
    )}
    height="18"
    viewBox="0 0 24 24"
    width="18"
  >
    <path d={BOOKMARK_PATH} strokeLinejoin="round" />
  </svg>
);

type Toggle =
  | { readonly placeId: string; readonly save: true }
  | { readonly restaurantId: string; readonly save: false };

export const WantToGoToggle = (props: {
  readonly place: typeof Place.Type;
}) => {
  const { api, queryClient } = useRouteContext({ from: "__root__" });
  const list = useQuery(wantToGoQuery(api));

  const toggle = useMutation({
    // oxlint-disable-next-line typescript/promise-function-async -- TanStack Query runs mutation functions as native Promises.
    mutationFn: (change: Toggle) =>
      Effect.runPromise(
        change.save
          ? addToWantToGo(api, change.placeId)
          : removeFromWantToGo(api, change.restaurantId)
      ),
    // oxlint-disable-next-line typescript/promise-function-async -- TanStack Query keeps the mutation pending until this native Promise settles.
    onSettled: () => queryClient.invalidateQueries({ queryKey: wantToGoKey }),
  });

  if (list.data?._tag !== "WantToGoRead") {
    return null;
  }

  const entry = list.data.restaurants.find(
    ({ restaurant }) => restaurant.placeId === props.place.placeId
  );

  const busy = toggle.isPending || list.isFetching;
  const saved = toggle.isPending ? toggle.variables.save : entry !== undefined;

  return (
    <div className="flex flex-col items-end">
      <Button
        aria-disabled={busy}
        aria-pressed={saved}
        className="text-foreground mx-0 gap-1.5"
        onClick={() => {
          if (busy) {
            return;
          }

          toggle.mutate(
            entry === undefined
              ? { placeId: props.place.placeId, save: true }
              : { restaurantId: entry.restaurant.id, save: false }
          );
        }}
        type="button"
        variant="quiet"
      >
        <BookmarkGlyph saved={saved} />
        Want to go<span className="sr-only"> to {props.place.name}</span>
      </Button>
      {toggle.isError ? (
        <p className="text-destructive text-sm" role="alert">
          Couldn’t update your list.
        </p>
      ) : null}
    </div>
  );
};
