import type { ApiStatus } from "#/client/savour-api";

export const en = {
  shell: {
    api: "API",
    apiStatus: {
      ok: "ok",
      unavailable: "unavailable",
    } satisfies Record<ApiStatus, string>,
    emptyLog: "Restaurants you log will show up here.",
    name: "Savour",
  },
  titles: {
    app: "Savour",
  },
};

export type Messages = typeof en;
