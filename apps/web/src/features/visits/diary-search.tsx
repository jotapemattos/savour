import { Effect, Fiber } from "effect";
import { useEffect, useState } from "react";
import type { Ref, SubmitEvent } from "react";

import { Field } from "#/features/accounts/field";

const SETTLE = "250 millis";

const searchOf = (draft: string) => {
  const q = draft.trim();

  return q === "" ? undefined : q;
};

export const useDiarySearch = (
  q: string | undefined,
  onSearch: (q?: string) => void
) => {
  const [draft, setDraft] = useState(q ?? "");

  useEffect(() => {
    const next = searchOf(draft);

    const settled = Effect.runFork(
      next === q
        ? Effect.void
        : Effect.sleep(SETTLE).pipe(
            Effect.andThen(
              Effect.sync(() => {
                onSearch(next);
              })
            )
          )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(settled));
    };
  }, [draft, q, onSearch]);

  return {
    clear: () => {
      setDraft("");
      onSearch();
    },
    draft,
    flush: () => {
      onSearch(searchOf(draft));
    },
    setDraft,
  };
};

export const DiarySearch = (props: {
  readonly draft: string;
  readonly form: Ref<HTMLFormElement>;
  readonly onDraft: (draft: string) => void;
  readonly onFlush: () => void;
}) => {
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    props.onFlush();
  };

  return (
    <form onSubmit={submit} ref={props.form} role="search">
      <Field
        autoComplete="off"
        enterKeyHint="search"
        hint="Matches the tags and dishes on your visits."
        id="diary-search"
        label="Search your diary"
        maxLength={200}
        name="q"
        onChange={(event) => {
          props.onDraft(event.currentTarget.value);
        }}
        placeholder="Date night, ramen…"
        type="search"
        value={props.draft}
      />
    </form>
  );
};
