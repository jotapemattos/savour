import type { ReactNode } from "react";

import type { ApiStatus } from "#/client/savour-api";
import type { Messages } from "#/i18n/en";
import { cn } from "#/lib/utils";

export const SavourShell = (props: {
  readonly apiStatus: ApiStatus;
  readonly children: ReactNode;
  readonly messages: Messages["shell"];
}) => (
  <div className="flex min-h-dvh w-full min-w-0 flex-col overflow-x-clip">
    <header className="border-border bg-background/90 sticky top-0 z-10 border-b pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex min-h-14 w-full max-w-2xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
        <h1 className="text-lg font-semibold tracking-tight">
          {props.messages.name}
        </h1>
        <p className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              props.apiStatus === "ok" ? "bg-success" : "bg-warning"
            )}
          />
          {props.messages.api}{" "}
          <output>{props.messages.apiStatus[props.apiStatus]}</output>
        </p>
      </div>
    </header>
    <main className="mx-auto w-full max-w-2xl min-w-0 flex-1 px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] wrap-anywhere">
      {props.children}
    </main>
  </div>
);
