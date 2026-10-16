import { afterEach, describe, expect, it } from "@effect/vitest";
import { RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { Effect, Layer, Schedule } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";

import type { ApiTransport } from "../src/client/savour-api";
import { SavourShell } from "../src/features/shell/savour-shell";
import { createSavourRouter } from "../src/savour-router";

afterEach(cleanup);

const healthBody = JSON.stringify({
  next: [
    {
      description: "Read the OpenAPI document for every Savour capability.",
      href: "/openapi.json",
      rel: "describedby",
    },
  ],
  service: "savour-api",
  status: "ok",
});

const recordingTransport = (requests: string[]): ApiTransport => ({
  baseUrl: "http://localhost:3000/api",
  layer: Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) =>
      Effect.sync(() => {
        requests.push(`${request.method} ${url.pathname}`);

        return HttpClientResponse.fromWeb(
          request,
          new Response(healthBody, {
            headers: { "content-type": "application/json" },
            status: 200,
          })
        );
      })
    )
  ),
});

const appearedStatus = Effect.try(() => screen.getByRole("status")).pipe(
  Effect.retry({ schedule: Schedule.spaced("10 millis"), times: 200 })
);

describe("web shell", () => {
  it("renders the shell at phone width", () => {
    render(<SavourShell apiStatus="ok">content</SavourShell>);

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
      const router = createSavourRouter(recordingTransport(requests));

      render(<RouterProvider router={router} />);
      const status = yield* appearedStatus;

      expect(status.textContent).toBe("ok");
      expect(requests).toStrictEqual(["GET /api/health"]);
    })
  );
});
