import type { DiaryEntry } from "@savour/core/contracts";
import type { UseQueryResult } from "@tanstack/react-query";
import { Link, Navigate } from "@tanstack/react-router";
import { Match } from "effect";

import type { DiaryOutcome as Outcome } from "#/client/visits";
import { Button } from "#/components/ui/button";

import { DiaryList } from "./diary-list";

const EmptyDiary = () => (
  <div className="flex flex-col items-start gap-3">
    <p className="font-medium text-pretty">No visits yet</p>
    <p className="text-muted-foreground text-pretty">
      Find a restaurant you’ve been to and log your first visit.
    </p>
    <Link
      className="bg-primary text-primary-foreground focus-visible:outline-primary inline-flex h-11 items-center justify-center rounded-lg px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 active:opacity-90"
      to="/search"
    >
      Find a restaurant
    </Link>
  </div>
);

const NoMatches = (props: {
  readonly onClear: () => void;
  readonly q: string;
}) => (
  <div className="flex min-w-0 flex-col items-start gap-2">
    <p className="line-clamp-3 font-medium text-pretty wrap-anywhere">
      No visits match “{props.q}”
    </p>
    <p className="text-muted-foreground text-pretty">
      Try another tag or dish.
    </p>
    <Button onClick={props.onClear} type="button" variant="quiet">
      Clear search
    </Button>
  </div>
);

const DiaryUnavailable = (props: { readonly onRetry: () => void }) => (
  <div className="flex flex-col items-start gap-2">
    <p className="text-pretty" role="alert">
      Your diary couldn’t load. Try again in a moment.
    </p>
    <Button onClick={props.onRetry} type="button" variant="quiet">
      Try again
    </Button>
  </div>
);

export const DiaryOutcome = (props: {
  readonly diary: UseQueryResult<Outcome>;
  readonly onClear: () => void;
  readonly onEdit: (visit: typeof DiaryEntry.Type) => void;
}) => {
  if (props.diary.isError) {
    return (
      <DiaryUnavailable
        onRetry={() => {
          void props.diary.refetch();
        }}
      />
    );
  }

  if (props.diary.data === undefined) {
    return (
      <p className="text-muted-foreground" role="status">
        Loading your diary…
      </p>
    );
  }

  return Match.value(props.diary.data).pipe(
    Match.tag("DiarySignedOut", () => <Navigate replace to="/sign-in" />),
    Match.tag("DiaryRead", (diary) => {
      if (diary.visits.length > 0) {
        return <DiaryList onEdit={props.onEdit} visits={diary.visits} />;
      }

      return diary.q === "" ? (
        <EmptyDiary />
      ) : (
        <NoMatches onClear={props.onClear} q={diary.q} />
      );
    }),
    Match.exhaustive
  );
};
