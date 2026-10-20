import type { DiaryEntry } from "@savour/core/contracts";
import { useEffect, useRef, useState } from "react";

import { Button } from "#/components/ui/button";

import { formatVisitDay } from "./diary-list";

export const DeleteVisit = (props: {
  readonly deleting: boolean;
  readonly onDelete: () => void;
  readonly visit: typeof DiaryEntry.Type;
}) => {
  const [confirming, setConfirming] = useState(false);
  const answered = useRef(false);
  const ask = useRef<HTMLButtonElement>(null);
  const keep = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (answered.current) {
      (confirming ? keep : ask).current?.focus();
    }
  }, [confirming]);

  const answer = (next: boolean) => {
    answered.current = true;
    setConfirming(next);
  };

  if (!confirming) {
    return (
      <Button
        className="text-destructive hover:text-destructive"
        onClick={() => {
          answer(true);
        }}
        ref={ask}
        type="button"
        variant="quiet"
      >
        Delete visit
      </Button>
    );
  }

  return (
    <div
      aria-labelledby="delete-title"
      className="border-border flex flex-col gap-3 rounded-lg border p-4"
      role="group"
    >
      <p className="font-medium text-pretty" id="delete-title">
        Delete this visit?
      </p>
      <p className="text-muted-foreground text-sm text-pretty">
        Your visit to {props.visit.place?.name ?? "this restaurant"} on{" "}
        {formatVisitDay(props.visit.date)} will be removed from your diary. This
        can’t be undone.
      </p>
      <div className="flex flex-col gap-2">
        <Button
          aria-disabled={props.deleting}
          onClick={() => {
            if (!props.deleting) {
              props.onDelete();
            }
          }}
          type="button"
          variant="destructive"
        >
          {props.deleting ? "Deleting…" : "Delete visit"}
        </Button>
        <Button
          onClick={() => {
            answer(false);
          }}
          ref={keep}
          type="button"
          variant="quiet"
        >
          Keep it
        </Button>
      </div>
    </div>
  );
};
