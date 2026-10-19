import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useRouteContext } from "@tanstack/react-router";

import { diaryQuery } from "#/client/visits";
import { DiaryOutcome } from "#/features/visits/diary-outcome";

const DiaryScreen = () => {
  const { api } = useRouteContext({ from: "/diary" });
  const diary = useQuery(diaryQuery(api));

  return (
    <section aria-labelledby="diary-title" className="flex flex-col gap-6">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h2
          className="text-2xl font-semibold tracking-tight text-balance"
          id="diary-title"
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
      <DiaryOutcome diary={diary} />
    </section>
  );
};

export const Route = createFileRoute("/diary")({
  component: DiaryScreen,
  head: () => ({ meta: [{ title: "Your diary · Savour" }] }),
});
