import { useRouteContext } from "@tanstack/react-router";
import { useMemo } from "react";

import { en } from "./en";
import type { Messages } from "./en";
import { formatters } from "./locale";
import type { Locale } from "./locale";

export const catalogs = { en, "pt-BR": en } satisfies Record<
  typeof Locale.Type,
  Messages
>;

export const useMessages = () => {
  const { locale } = useRouteContext({ from: "__root__" });

  return useMemo(
    () => ({ f: formatters(locale), t: catalogs[locale] }),
    [locale]
  );
};
