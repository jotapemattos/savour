import { SearchQuery } from "@savour/core/contracts";
import type { Place } from "@savour/core/contracts";
import { useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useRouteContext,
  useSearch,
} from "@tanstack/react-router";
import { Option, Schema } from "effect";
import { AnimatePresence, MotionConfig } from "motion/react";
import { useState } from "react";

import { restaurantSearchQuery } from "#/client/restaurant-search";
import { SearchForm } from "#/features/search/search-form";
import { SearchOutcome } from "#/features/search/search-outcome";
import { LogSheet } from "#/features/visits/log-sheet";

const SearchParams = Schema.Struct({ q: Schema.optional(SearchQuery) });

const decodeSearchParams = Schema.decodeUnknownOption(SearchParams);

const SearchScreen = () => {
  const { q } = useSearch({ from: "/search" });
  const { api } = useRouteContext({ from: "/search" });
  const navigate = useNavigate({ from: "/search" });
  const search = useQuery(restaurantSearchQuery(api, q));
  const [logging, setLogging] = useState<typeof Place.Type | null>(null);

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
          onSearch={(next) => {
            void navigate({ search: { q: next } });
          }}
        />
        <SearchOutcome onLog={setLogging} q={q} search={search} />
      </section>
      <AnimatePresence>
        {logging === null ? null : (
          <LogSheet
            key={logging.placeId}
            onClose={() => {
              setLogging(null);
            }}
            onLogged={() => {
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
