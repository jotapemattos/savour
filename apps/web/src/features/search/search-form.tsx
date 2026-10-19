import { SearchQuery } from "@savour/core/contracts";
import { Option, Schema } from "effect";
import type { SubmitEvent } from "react";

import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";

const decodeQuery = Schema.decodeUnknownOption(SearchQuery);

export const SearchForm = (props: {
  readonly initialQuery: string | undefined;
  readonly onSearch: (q: string) => void;
}) => {
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const field = event.currentTarget.elements.namedItem("q");

    if (!(field instanceof HTMLInputElement)) {
      return;
    }

    Option.match(decodeQuery(field.value.trim()), {
      onNone: () => {
        field.focus();
      },
      onSome: props.onSearch,
    });
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
    </form>
  );
};
