import type { DiaryEntry } from "@savour/core/contracts";
import { DateTime, Option } from "effect";

import { RatingStars } from "./stars";

const visitDay = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export const formatVisitDay = (date: string) =>
  DateTime.make(`${date}T00:00:00Z`).pipe(
    Option.map((day) => DateTime.formatIntl(day, visitDay)),
    Option.getOrElse(() => date)
  );

export const DiaryList = (props: {
  readonly onEdit: (visit: typeof DiaryEntry.Type) => void;
  readonly visits: readonly (typeof DiaryEntry.Type)[];
}) => (
  <ul className="divide-border -mx-2 flex flex-col divide-y">
    {props.visits.map((visit) => (
      <li className="flex min-w-0" key={visit.id}>
        <button
          className="focus-visible:outline-primary active:bg-muted flex min-h-11 w-full min-w-0 touch-manipulation flex-col gap-1.5 rounded-lg px-2 py-3 text-left transition-colors duration-150 select-none focus-visible:outline-2 focus-visible:-outline-offset-2"
          onClick={() => {
            props.onEdit(visit);
          }}
          type="button"
        >
          <span className="flex min-w-0 items-baseline justify-between gap-3">
            {visit.place === null ? (
              <span className="text-muted-foreground min-w-0 text-pretty">
                Restaurant details unavailable
              </span>
            ) : (
              <span className="min-w-0 font-medium text-pretty">
                {visit.place.name}
              </span>
            )}
            <time
              className="text-muted-foreground shrink-0 text-sm tabular-nums"
              dateTime={visit.date}
            >
              {formatVisitDay(visit.date)}
            </time>
          </span>
          {visit.rating === null ? null : <RatingStars rating={visit.rating} />}
          {visit.review === null ? null : (
            <span className="text-muted-foreground line-clamp-3 text-sm text-pretty">
              {visit.review}
            </span>
          )}
        </button>
      </li>
    ))}
  </ul>
);
