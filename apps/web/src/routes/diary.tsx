import { SearchQuery } from "@savour/core/contracts";
import type { DiaryEntry } from "@savour/core/contracts";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  Link,
  createFileRoute,
  useNavigate,
  useRouteContext,
  useSearch,
} from "@tanstack/react-router";
import { Option, Schema } from "effect";
import { AnimatePresence, MotionConfig } from "motion/react";
import { useCallback, useRef, useState } from "react";

import { diaryQuery } from "#/client/visits";
import type { DiaryOutcome as Outcome } from "#/client/visits";
import { DiaryOutcome } from "#/features/visits/diary-outcome";
import { DiarySearch, useDiarySearch } from "#/features/visits/diary-search";
import { LogSheet } from "#/features/visits/log-sheet";

const SearchParams = Schema.Struct({ q: Schema.optional(SearchQuery) });

const decodeSearchParams = Schema.decodeUnknownOption(SearchParams);

const searchable = (q: string | undefined, diary: UseQueryResult<Outcome>) =>
  q !== undefined ||
  (diary.data?._tag === "DiaryRead" &&
    (diary.data.q !== "" || diary.data.visits.length > 0));

const matchCount = (diary: UseQueryResult<Outcome>) => {
  if (diary.data?._tag !== "DiaryRead" || diary.data.q === "") {
    return "";
  }

  if (diary.isPlaceholderData) {
    return "";
  }

  const count = diary.data.visits.length;

  return `${count} ${count === 1 ? "visit matches" : "visits match"} “${diary.data.q}”`;
};

const DiaryScreen = () => {
  const { q } = useSearch({ from: "/diary" });
  const { api } = useRouteContext({ from: "/diary" });
  const navigate = useNavigate({ from: "/diary" });
  const diary = useQuery(diaryQuery(api, q));
  const searchForm = useRef<HTMLFormElement>(null);

  const searchFor = useCallback(
    (next?: string) => {
      void navigate({ replace: true, search: { q: next } });
    },
    [navigate]
  );

  const search = useDiarySearch(q, searchFor);

  const clearSearch = () => {
    search.clear();
    const box = searchForm.current?.elements.namedItem("q");

    if (box instanceof HTMLInputElement) {
      box.focus();
    }
  };

  const [editing, setEditing] = useState<typeof DiaryEntry.Type | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const close = () => {
    setEditing(null);
  };

  return (
    <MotionConfig reducedMotion="user">
      <section aria-labelledby="diary-title" className="flex flex-col gap-6">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <h2
            className="text-2xl font-semibold tracking-tight text-balance"
            id="diary-title"
            ref={heading}
            tabIndex={-1}
          >
            Your diary
          </h2>
          <Link
            className="text-muted-foreground hover:text-foreground focus-visible:outline-primary active:bg-muted -mx-2 inline-flex h-10 shrink-0 items-center rounded-lg px-2 focus-visible:outline-2 focus-visible:outline-offset-2"
            to="/search"
          >
            Log a visit
          </Link>
        </div>
        {searchable(q, diary) ? (
          <DiarySearch
            draft={search.draft}
            form={searchForm}
            onDraft={search.setDraft}
            onFlush={search.flush}
          />
        ) : null}
        <p className="sr-only" role="status">
          {matchCount(diary)}
        </p>
        <DiaryOutcome diary={diary} onClear={clearSearch} onEdit={setEditing} />
      </section>
      <AnimatePresence>
        {editing === null ? null : (
          <LogSheet
            focusAfterDelete={heading}
            key={editing.id}
            onClose={close}
            onDone={close}
            visit={editing}
          />
        )}
      </AnimatePresence>
    </MotionConfig>
  );
};

export const Route = createFileRoute("/diary")({
  component: DiaryScreen,
  head: () => ({ meta: [{ title: "Your diary · Savour" }] }),
  validateSearch: (
    search: Readonly<Record<string, string>>
  ): typeof SearchParams.Type =>
    Option.getOrElse(decodeSearchParams(search), () => ({ q: undefined })),
});
