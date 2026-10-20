import type { DiaryEntry, Place } from "@savour/core/contracts";
import { useMutation } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { DateTime, Effect, Predicate, Schema, SchemaGetter } from "effect";
import type { Types } from "effect";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { RefObject, SubmitEvent } from "react";

import type { ApiTransport } from "#/client/savour-api";
import {
  VisitEdited,
  deleteVisit,
  diaryQuery,
  editVisit,
  logVisit,
} from "#/client/visits";
import type { VisitChanges } from "#/client/visits";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import { Field } from "#/features/accounts/field";

import { DeleteVisit } from "./delete-visit";
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

type SheetSubject =
  | { readonly place: typeof Place.Type; readonly visit?: undefined }
  | { readonly place?: undefined; readonly visit: typeof DiaryEntry.Type };

const encodeTags = Schema.encodeSync(TagList);

const fieldsOf = (form: FormData) =>
  Schema.decodeUnknownEffect(LogVisitForm)(
    Object.fromEntries(
      [...form].filter(
        ([, value]) => !(value instanceof File) && value.trim() !== ""
      )
    )
  );

const sameTags = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length &&
  left.every((tag, index) => tag === right[index]);

const changesFrom = (
  visit: typeof DiaryEntry.Type,
  fields: typeof LogVisitForm.Type
): VisitChanges => {
  const changes: Types.Mutable<VisitChanges> = {};
  const rating = fields.rating ?? null;
  const review = fields.review ?? null;
  const tags = fields.tags ?? [];

  if (fields.date !== visit.date) {
    changes.date = fields.date;
  }

  if (rating !== visit.rating) {
    changes.rating = rating;
  }

  if (review !== visit.review) {
    changes.review = review;
  }

  if (!sameTags(tags, visit.tags)) {
    changes.tags = tags;
  }

  return changes;
};

const saveVisit = (api: ApiTransport, subject: SheetSubject, form: FormData) =>
  Effect.gen(function* saveFromSheet() {
    const fields = yield* fieldsOf(form);

    if (subject.visit === undefined) {
      return yield* logVisit(api, {
        ...fields,
        placeId: subject.place.placeId,
      });
    }

    const changes = changesFrom(subject.visit, fields);

    if (Object.keys(changes).length === 0) {
      return VisitEdited.make({ visit: subject.visit });
    }

    return yield* editVisit(api, subject.visit.id, changes);
  });

const problemOf = (failure: {
  readonly deleteFailed: boolean;
  readonly gone: boolean;
  readonly saveFailed: boolean;
}) => {
  if (failure.gone) {
    return "This visit is no longer in your diary.";
  }

  if (failure.deleteFailed) {
    return "Savour couldn’t delete this visit. Check your connection and try again.";
  }

  if (failure.saveFailed) {
    return "Savour couldn’t save this visit. Check your connection and try again.";
  }

  return null;
};

const submitLabelOf = (saving: boolean, logging: boolean) => {
  if (saving) {
    return "Saving…";
  }

  return logging ? "Save visit" : "Save changes";
};

const useVisitMutations = (subject: SheetSubject, onDone: () => void) => {
  const { api, queryClient } = useRouteContext({ from: "__root__" });

  const refreshDiary = () => {
    void queryClient.invalidateQueries({ queryKey: diaryQuery(api).queryKey });
  };

  const save = useMutation({
    // oxlint-disable-next-line typescript/promise-function-async -- TanStack Query runs mutation functions as native Promises.
    mutationFn: (form: FormData) =>
      Effect.runPromise(saveVisit(api, subject, form)),
    onSuccess: (outcome) => {
      if (Predicate.isTagged(outcome, "VisitNotFound")) {
        refreshDiary();
      }

      if (
        Predicate.isTagged(outcome, "VisitLogged") ||
        Predicate.isTagged(outcome, "VisitEdited")
      ) {
        refreshDiary();
        onDone();
      }
    },
  });

  const remove = useMutation({
    // oxlint-disable-next-line typescript/promise-function-async -- TanStack Query runs mutation functions as native Promises.
    mutationFn: (id: string) => Effect.runPromise(deleteVisit(api, id)),
    onSettled: refreshDiary,
  });

  return { remove, save };
};

export const LogSheet = (
  props: SheetSubject & {
    readonly focusAfterDelete?: RefObject<HTMLElement | null>;
    readonly onClose: () => void;
    readonly onDone: () => void;
  }
) => {
  const sheet = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<Element | null>(null);
  const reduceMotion = useReducedMotion() === true;
  const [today] = useState(localToday);
  const { remove, save } = useVisitMutations(props, props.onDone);
  const refusal = save.data;
  const editing = props.visit;

  const gone =
    Predicate.isTagged(refusal, "VisitNotFound") ||
    Predicate.isTagged(remove.data, "VisitNotFound");

  const problem = problemOf({
    deleteFailed: remove.isError,
    gone,
    saveFailed: save.isError,
  });

  useEffect(() => {
    returnFocus.current = document.activeElement;
    sheet.current?.showModal();

    return () => {
      const target = returnFocus.current;

      if (target instanceof HTMLElement) {
        target.focus();
      }
    };
  }, []);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!save.isPending) {
      save.mutate(new FormData(event.currentTarget));
    }
  };

  const deleteEditing = (visit: typeof DiaryEntry.Type) => {
    remove.mutate(visit.id, {
      onSuccess: (outcome) => {
        if (Predicate.isTagged(outcome, "VisitRemoved")) {
          returnFocus.current = props.focusAfterDelete?.current ?? null;
          props.onDone();
        }
      },
    });
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
              {editing === undefined ? "Log a visit" : "Edit visit"}
            </h2>
            <p className="text-muted-foreground text-sm text-pretty">
              {editing === undefined
                ? props.place.name
                : (editing.place?.name ?? "Restaurant details unavailable")}
            </p>
          </div>
          <Button onClick={props.onClose} type="button" variant="quiet">
            Cancel
          </Button>
        </div>
        <form className="flex flex-col gap-5" onSubmit={submit}>
          <Field
            defaultValue={editing?.date ?? today}
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
            defaultValue={editing?.rating ?? null}
            name="rating"
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="visit-review">Review (optional)</Label>
            <textarea
              className="border-border bg-background placeholder:text-muted-foreground focus-visible:outline-primary min-h-24 w-full min-w-0 rounded-lg border px-3 py-2 text-base focus-visible:outline-2 focus-visible:-outline-offset-1"
              defaultValue={editing?.review ?? undefined}
              id="visit-review"
              maxLength={2000}
              name="review"
              placeholder="What stood out?"
            />
          </div>
          <Field
            autoCapitalize="none"
            defaultValue={
              editing === undefined ? undefined : encodeTags(editing.tags)
            }
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
            {problem}
          </p>
          <Button aria-disabled={save.isPending} type="submit">
            {submitLabelOf(save.isPending, editing === undefined)}
          </Button>
        </form>
        {editing === undefined ? null : (
          <DeleteVisit
            deleting={remove.isPending}
            onDelete={() => {
              deleteEditing(editing);
            }}
            visit={editing}
          />
        )}
      </div>
    </motion.dialog>
  );
};
