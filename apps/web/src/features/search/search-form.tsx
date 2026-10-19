import { SearchQuery } from "@savour/core/contracts";
import { Option, Schema } from "effect";
import type { MouseEvent, SubmitEvent } from "react";

import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";

const decodeQuery = Schema.decodeUnknownOption(SearchQuery);

const readQuery = (form: HTMLFormElement | null) => {
  const field = form?.elements.namedItem("q");

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
  readonly onSearchNear: (q: string) => void;
}) => {
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    Option.map(readQuery(event.currentTarget), props.onSearch);
  };

  const searchNear = (event: MouseEvent<HTMLButtonElement>) => {
    if (!props.locating) {
      Option.map(readQuery(event.currentTarget.form), props.onSearchNear);
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
        <Button className="w-auto" type="submit">
          Search
        </Button>
      </div>
      <Button
        aria-disabled={props.locating}
        className="self-start"
        onClick={searchNear}
        type="button"
        variant="quiet"
      >
        {props.locating ? "Locating…" : "Search near me"}
      </Button>
    </form>
  );
};
