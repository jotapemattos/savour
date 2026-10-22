import { afterEach, describe, expect, it } from "@effect/vitest";
import { RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { Effect, Schedule } from "effect";

import { SavourShell } from "../src/features/shell/savour-shell";
import { en } from "../src/i18n/en";
import { createSavourRouter } from "../src/savour-router";
import { memorySession, scriptedApi } from "./fixtures/scripted-api";

afterEach(cleanup);

const appearedStatus = Effect.try(() => screen.getByRole("status")).pipe(
  Effect.retry({ schedule: Schedule.spaced("10 millis"), times: 200 })
);

describe("web shell", () => {
  it("renders the shell at phone width", () => {
    render(
      <SavourShell apiStatus="ok" messages={en.shell}>
        content
      </SavourShell>
    );

    const banner = screen.getByRole("banner");
    const root = banner.parentElement;

    expect(window.innerWidth).toBe(375);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Savour"
    );
    expect(root?.classList.contains("overflow-x-clip")).toBe(true);
    expect(root?.classList.contains("min-w-0")).toBe(true);
  });

  it.live("loads data only through the typed HTTP client", () =>
    Effect.gen(function* rendersHealthFromClient() {
      const requests: string[] = [];
      const api = scriptedApi({}, requests);
      const router = createSavourRouter(api, memorySession(api));

      render(<RouterProvider router={router} />);
      const status = yield* appearedStatus;

      expect(status.textContent).toBe("ok");
      expect(requests).toStrictEqual(["GET /api/health", "GET /api/account"]);
    })
  );

  it.live.each(["en", "pt-BR"] as const)(
    "sets <html lang> from the %s locale",
    (locale) =>
      Effect.gen(function* setsDocumentLanguage() {
        const api = scriptedApi({});

        render(
          <RouterProvider
            router={createSavourRouter(api, memorySession(api), locale)}
          />
        );
        yield* appearedStatus;

        expect(document.documentElement.lang).toBe(locale);
      })
  );
});
