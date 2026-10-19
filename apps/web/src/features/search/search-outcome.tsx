import type { Place } from "@savour/core/contracts";
import type { UseQueryResult } from "@tanstack/react-query";
import { Match, Predicate } from "effect";
import { AnimatePresence, motion } from "motion/react";

import type { SearchOutcome as Outcome } from "#/client/restaurant-search";
import { Button } from "#/components/ui/button";

import { PlaceList } from "./place-list";

const EXIT = { duration: 0.15, ease: [0.23, 1, 0.32, 1] } as const;

const SearchUnavailableNotice = (props: { readonly onRetry: () => void }) => (
  <div className="flex flex-col items-start gap-2">
    <p className="text-pretty" role="alert">
      Search isn’t working right now. Try again in a moment.
    </p>
    <Button onClick={props.onRetry} type="button" variant="quiet">
      Try again
    </Button>
  </div>
);

const NoMatches = (props: {
  readonly canAddByHand: boolean;
  readonly q: string;
}) => (
  <div className="flex flex-col items-start gap-2">
    <p className="font-medium text-pretty">Nothing matches “{props.q}”.</p>
    <p className="text-muted-foreground text-sm text-pretty">
      Try another dish or the restaurant’s name.
    </p>
    {props.canAddByHand ? (
      <div className="flex items-center gap-3">
        <Button
          aria-describedby="add-by-hand-soon"
          aria-disabled
          type="button"
          variant="quiet"
        >
          Add it by hand
        </Button>
        <span className="text-muted-foreground text-sm" id="add-by-hand-soon">
          Coming soon
        </span>
      </div>
    ) : null}
  </div>
);

const announcement = (search: UseQueryResult<Outcome>) => {
  if (search.isFetching) {
    return "Searching…";
  }

  if (Predicate.isTagged(search.data, "PlacesFound")) {
    return search.data.places.length === 1
      ? "1 restaurant found"
      : `${search.data.places.length} restaurants found`;
  }

  return "";
};

const settled = (
  search: UseQueryResult<Outcome>,
  q: string,
  onLog: (place: typeof Place.Type) => void
) => {
  if (search.isError) {
    return (
      <SearchUnavailableNotice
        onRetry={() => {
          void search.refetch();
        }}
      />
    );
  }

  if (search.data === undefined) {
    return null;
  }

  return Match.value(search.data).pipe(
    Match.tag("SearchUnavailable", () => (
      <SearchUnavailableNotice
        onRetry={() => {
          void search.refetch();
        }}
      />
    )),
    Match.tag("PlacesFound", (found) =>
      found.places.length === 0 ? (
        <NoMatches canAddByHand={found.canAddByHand} q={q} />
      ) : (
        <PlaceList onLog={onLog} places={found.places} />
      )
    ),
    Match.exhaustive
  );
};

export const SearchOutcome = (props: {
  readonly onLog: (place: typeof Place.Type) => void;
  readonly q: string | undefined;
  readonly search: UseQueryResult<Outcome>;
}) => (
  <div className="flex flex-col gap-4">
    <p className="sr-only" role="status">
      {props.q === undefined ? "" : announcement(props.search)}
    </p>
    <AnimatePresence initial={false} mode="wait">
      {props.q === undefined || props.search.isFetching ? null : (
        <motion.div exit={{ opacity: 0, transition: EXIT }} key={props.q}>
          {settled(props.search, props.q, props.onLog)}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);
