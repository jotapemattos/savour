import type { DiaryEntry } from "@savour/core/contracts";
import { DateTime, Option } from "effect";

import { RatingStars } from "./stars";

const visitDay = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const formatVisitDay = (date: string) =>
  DateTime.make(`${date}T00:00:00Z`).pipe(
    Option.map((day) => DateTime.formatIntl(day, visitDay)),
    Option.getOrElse(() => date)
  );

export const DiaryList = (props: {
  readonly visits: readonly (typeof DiaryEntry.Type)[];
}) => (
  <ul className="divide-border flex flex-col divide-y">
    {props.visits.map((visit) => (
      <li className="flex min-w-0 flex-col gap-1.5 py-3" key={visit.id}>
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          {visit.place === null ? (
            <p className="text-muted-foreground min-w-0 text-pretty">
              Restaurant details unavailable
            </p>
          ) : (
            <p className="min-w-0 font-medium text-pretty">
              {visit.place.name}
            </p>
          )}
          <time
            className="text-muted-foreground shrink-0 text-sm tabular-nums"
            dateTime={visit.date}
          >
            {formatVisitDay(visit.date)}
          </time>
        </div>
        {visit.rating === null ? null : <RatingStars rating={visit.rating} />}
        {visit.review === null ? null : (
          <p className="text-muted-foreground line-clamp-3 text-sm text-pretty">
            {visit.review}
          </p>
        )}
      </li>
    ))}
  </ul>
);
