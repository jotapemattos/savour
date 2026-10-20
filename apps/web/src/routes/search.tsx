import { SearchQuery } from "@savour/core/contracts";
import type { Place } from "@savour/core/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useRouteContext,
  useSearch,
} from "@tanstack/react-router";
import { Effect, Match, Option, Schema } from "effect";
import { AnimatePresence, MotionConfig } from "motion/react";
import { useState } from "react";

import { approximateLocation } from "#/client/approximate-location";
import type { LocationOutcome } from "#/client/approximate-location";
import { restaurantSearchQuery } from "#/client/restaurant-search";
import { SearchForm } from "#/features/search/search-form";
import { SearchOutcome } from "#/features/search/search-outcome";
import { LogSheet } from "#/features/visits/log-sheet";

const SearchParams = Schema.Struct({ q: Schema.optional(SearchQuery) });

const decodeSearchParams = Schema.decodeUnknownOption(SearchParams);

const LocationNote = (props: { readonly location: LocationOutcome }) => (
  <p className="text-muted-foreground text-sm text-pretty">
    {Match.value(props.location).pipe(
      Match.tag("Located", () => "Showing places near you first."),
      Match.tag(
        "LocationOff",
        () => "Location is off, so results aren’t sorted by distance."
      ),
      Match.exhaustive
    )}
  </p>
);

const SearchScreen = () => {
  const { q } = useSearch({ from: "/search" });
  const { api } = useRouteContext({ from: "/search" });
  const navigate = useNavigate({ from: "/search" });
  const [location, setLocation] = useState<LocationOutcome | null>(null);

  const search = useQuery(
    restaurantSearchQuery(
      api,
      q,
      location?._tag === "Located" ? location.near : undefined
    )
  );

  const [logging, setLogging] = useState<typeof Place.Type | null>(null);

  const locate = useMutation({
    // oxlint-disable-next-line typescript/promise-function-async -- TanStack Query runs mutation functions as native Promises.
    mutationFn: () => Effect.runPromise(approximateLocation),
  });

  return (
    <MotionConfig reducedMotion="user">
      <section aria-labelledby="search-title" className="flex flex-col gap-6">
        <h2
          className="text-2xl font-semibold tracking-tight text-balance"
          id="search-title"
        >
          Find a restaurant
        </h2>
        <SearchForm
          initialQuery={q}
          locating={locate.isPending}
          onSearch={(next) => {
            if (location !== null) {
              void navigate({ search: { q: next } });

              return;
            }

            locate.mutate(undefined, {
              onSuccess: (outcome) => {
                setLocation(outcome);
                void navigate({ search: { q: next } });
              },
            });
          }}
        />
        {location === null ? null : <LocationNote location={location} />}
        <SearchOutcome onLog={setLogging} q={q} search={search} />
      </section>
      <AnimatePresence>
        {logging === null ? null : (
          <LogSheet
            key={logging.placeId}
            onClose={() => {
              setLogging(null);
            }}
            onDone={() => {
              void navigate({ to: "/diary" });
            }}
            place={logging}
          />
        )}
      </AnimatePresence>
    </MotionConfig>
  );
};

export const Route = createFileRoute("/search")({
  component: SearchScreen,
  head: () => ({ meta: [{ title: "Find a restaurant · Savour" }] }),
  validateSearch: (
    search: Readonly<Record<string, string>>
  ): typeof SearchParams.Type =>
    Option.getOrElse(decodeSearchParams(search), () => ({ q: undefined })),
});
