import type { Place } from "@savour/core/contracts";
import { useMutation } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { DateTime, Effect, Predicate, Schema, SchemaGetter } from "effect";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";

import { diaryQuery, logVisit } from "#/client/visits";
import type { LogOutcome } from "#/client/visits";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import { Field } from "#/features/accounts/field";

import { RatingInput } from "./rating-input";

const SHEET_EASE = [0.32, 0.72, 0, 1] as const;

const dateMessages = {
  "in-the-future": "Pick today or an earlier day.",
  "not-a-day": "Enter the day of your visit.",
} as const;

const localToday = () =>
  DateTime.formatIsoDate(
    DateTime.setZone(DateTime.nowUnsafe(), DateTime.zoneMakeLocal())
  );

const TagList = Schema.String.pipe(
  Schema.decodeTo(Schema.Array(Schema.String), {
    decode: SchemaGetter.transform((text: string) =>
      text
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    ),
    encode: SchemaGetter.transform((tags: readonly string[]) =>
      tags.join(", ")
    ),
  })
);

const LogVisitForm = Schema.Struct({
  date: Schema.String,
  rating: Schema.optionalKey(Schema.FiniteFromString),
  review: Schema.optionalKey(Schema.Trim),
  tags: Schema.optionalKey(TagList),
});

const visitFrom = (placeId: string, form: FormData) =>
  Schema.decodeUnknownEffect(LogVisitForm)(
    Object.fromEntries(
      [...form].filter(
        ([, value]) => !(value instanceof File) && value.trim() !== ""
      )
    )
  ).pipe(Effect.map((fields) => ({ ...fields, placeId })));

const useLogVisit = (placeId: string, onLogged: () => void) => {
  const { api, queryClient } = useRouteContext({ from: "__root__" });

  return useMutation({
    // oxlint-disable-next-line typescript/promise-function-async -- TanStack Query runs mutation functions as native Promises.
    mutationFn: (form: FormData) =>
      Effect.runPromise(
        visitFrom(placeId, form).pipe(
          Effect.flatMap((input) => logVisit(api, input))
        )
      ),
    onSuccess: (outcome: LogOutcome) => {
      if (Predicate.isTagged(outcome, "VisitLogged")) {
        void queryClient.invalidateQueries({
          queryKey: diaryQuery(api).queryKey,
        });
        onLogged();
      }
    },
  });
};

export const LogSheet = (props: {
  readonly onClose: () => void;
  readonly onLogged: () => void;
  readonly place: typeof Place.Type;
}) => {
  const sheet = useRef<HTMLDialogElement>(null);
  const reduceMotion = useReducedMotion() === true;
  const [today] = useState(localToday);
  const log = useLogVisit(props.place.placeId, props.onLogged);
  const refusal = log.data;

  useEffect(() => {
    const trigger = document.activeElement;
    sheet.current?.showModal();

    return () => {
      if (trigger instanceof HTMLElement) {
        trigger.focus();
      }
    };
  }, []);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!log.isPending) {
      log.mutate(new FormData(event.currentTarget));
    }
  };

  const hidden = reduceMotion
    ? { opacity: 0 }
    : { opacity: 1, transform: "translateY(100%)" };

  return (
    <motion.dialog
      animate={{ opacity: 1, transform: "translateY(0%)" }}
      aria-labelledby="log-title"
      className="bg-background text-foreground backdrop:bg-foreground/30 mx-auto mt-auto mb-0 max-h-[85dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-2xl"
      exit={{ ...hidden, transition: { duration: 0.2, ease: SHEET_EASE } }}
      initial={hidden}
      onCancel={(event) => {
        event.preventDefault();
        props.onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          props.onClose();
        }
      }}
      ref={sheet}
      transition={{ duration: 0.3, ease: SHEET_EASE }}
    >
      <div className="flex flex-col gap-5 px-4 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2
              className="text-xl font-semibold tracking-tight text-balance"
              id="log-title"
            >
              Log a visit
            </h2>
            <p className="text-muted-foreground text-sm text-pretty">
              {props.place.name}
            </p>
          </div>
          <Button onClick={props.onClose} type="button" variant="quiet">
            Cancel
          </Button>
        </div>
        <form className="flex flex-col gap-5" onSubmit={submit}>
          <Field
            defaultValue={today}
            error={
              Predicate.isTagged(refusal, "InvalidVisitDate")
                ? dateMessages[refusal.reason]
                : undefined
            }
            id="visit-date"
            label="Date"
            max={today}
            name="date"
            required
            type="date"
          />
          <RatingInput
            error={
              Predicate.isTagged(refusal, "InvalidRating")
                ? "Pick from half a star to 5 stars."
                : undefined
            }
            name="rating"
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="visit-review">Review (optional)</Label>
            <textarea
              className="border-border bg-background placeholder:text-muted-foreground focus-visible:outline-primary min-h-24 w-full min-w-0 rounded-lg border px-3 py-2 text-base focus-visible:outline-2 focus-visible:-outline-offset-1"
              id="visit-review"
              maxLength={2000}
              name="review"
              placeholder="What stood out?"
            />
          </div>
          <Field
            autoCapitalize="none"
            hint="Separate tags with commas."
            id="visit-tags"
            label="Tags (optional)"
            name="tags"
            placeholder="date night, pizza"
          />
          <p
            className="text-destructive text-sm text-pretty empty:hidden"
            role="alert"
          >
            {log.isError
              ? "Savour couldn’t save this visit. Check your connection and try again."
              : undefined}
          </p>
          <Button aria-disabled={log.isPending} type="submit">
            {log.isPending ? "Saving…" : "Save visit"}
          </Button>
        </form>
      </div>
    </motion.dialog>
  );
};
