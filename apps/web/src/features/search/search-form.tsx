import { SearchQuery } from "@savour/core/contracts";
import { Option, Schema } from "effect";
import type { SubmitEvent } from "react";

import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";

const decodeQuery = Schema.decodeUnknownOption(SearchQuery);

const readQuery = (form: HTMLFormElement) => {
  const field = form.elements.namedItem("q");

  if (!(field instanceof HTMLInputElement)) {
    return Option.none();
  }

  const query = decodeQuery(field.value.trim());

  if (Option.isNone(query)) {
    field.focus();
  }

  return query;
};

export const SearchForm = (props: {
  readonly initialQuery: string | undefined;
  readonly locating: boolean;
  readonly onSearch: (q: string) => void;
}) => {
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!props.locating) {
      Option.map(readQuery(event.currentTarget), props.onSearch);
    }
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={submit} role="search">
      <Label htmlFor="search-query">Dish or restaurant</Label>
      <div className="flex gap-2">
        <Input
          autoComplete="off"
          defaultValue={props.initialQuery}
          enterKeyHint="search"
          id="search-query"
          maxLength={200}
          name="q"
          placeholder="Pizza, ramen…"
          type="search"
        />
        <Button aria-disabled={props.locating} className="w-auto" type="submit">
          Search
        </Button>
      </div>
      {props.locating ? (
        <p className="text-muted-foreground text-sm" role="status">
          Finding your location…
        </p>
      ) : null}
    </form>
  );
};
