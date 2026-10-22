import { afterEach, describe, expect, it } from "@effect/vitest";
import { HandleTaken, InvalidCredentials } from "@savour/core";
import { RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Effect, Schedule } from "effect";

import { en } from "../src/i18n/en";
import { createSavourRouter } from "../src/savour-router";
import {
  memorySession,
  refusedWith,
  scriptedApi,
  signedInAs,
} from "./fixtures/scripted-api";
import type { ScriptedReply } from "./fixtures/scripted-api";

afterEach(cleanup);

const appeared = <A,>(find: () => A) =>
  Effect.try(find).pipe(
    Effect.retry({ schedule: Schedule.spaced("10 millis"), times: 200 })
  );

const openAt = (
  path: string,
  script: Readonly<Record<string, ScriptedReply>>,
  kept: string[] = []
) => {
  window.history.replaceState(null, "", path);
  const api = scriptedApi(script);

  render(
    <RouterProvider
      router={createSavourRouter(api, memorySession(api, kept))}
    />
  );
};

const fillIn = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

const signUpAsAna = Effect.gen(function* fillsSignUp() {
  yield* appeared(() => screen.getByLabelText("Email"));
  fillIn("Email", "ana@example.test");
  fillIn("Handle", "ana");
  fillIn("Password", "correct horse");
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
});

const signInAsAna = Effect.gen(function* fillsSignIn() {
  yield* appeared(() => screen.getByLabelText("Email"));
  fillIn("Email", "ana@example.test");
  fillIn("Password", "correct horse");
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
});

describe("sign-up and sign-in screens", () => {
  it.live("completes sign-up at phone width", () =>
    Effect.gen(function* completesSignUp() {
      const kept: string[] = [];
      openAt("/sign-up", { "POST /api/accounts": signedInAs("ana") }, kept);

      yield* signUpAsAna;
      yield* appeared(() => screen.getByText("@ana"));

      expect(window.innerWidth).toBe(375);
      expect(window.location.pathname).toBe("/");
      expect(kept).toStrictEqual(["tok_ana"]);
      expect(document.body.textContent).not.toContain("tok_ana");
    })
  );

  it.live("signs in at phone width", () =>
    Effect.gen(function* completesSignIn() {
      const kept: string[] = [];
      openAt("/sign-in", { "POST /api/sessions": signedInAs("ana") }, kept);

      yield* signInAsAna;
      yield* appeared(() => screen.getByText("@ana"));

      expect(window.innerWidth).toBe(375);
      expect(window.location.pathname).toBe("/");
      expect(kept).toStrictEqual(["tok_ana"]);
    })
  );

  it.live("shows the typed failure next to the form", () =>
    Effect.gen(function* showsTypedFailures() {
      openAt("/sign-up", {
        "POST /api/accounts": refusedWith(
          HandleTaken,
          new HandleTaken({ handle: "ana" }),
          409
        ),
      });

      yield* signUpAsAna;

      const handleError = yield* appeared(() =>
        screen.getByText("That handle is taken. Try another one.")
      );

      expect(screen.getByLabelText("Handle").getAttribute("aria-invalid")).toBe(
        "true"
      );
      expect(
        screen.getByLabelText("Handle").getAttribute("aria-describedby")
      ).toContain(handleError.id);
      expect(window.location.pathname).toBe("/sign-up");

      cleanup();

      openAt("/sign-in", {
        "POST /api/sessions": refusedWith(
          InvalidCredentials,
          new InvalidCredentials(),
          401
        ),
      });

      yield* signInAsAna;

      const alert = yield* appeared(() =>
        screen.getByText(
          "That email and password don’t match. Check both and try again."
        )
      );

      expect(alert.getAttribute("role")).toBe("alert");
      expect(window.location.pathname).toBe("/sign-in");
    })
  );

  it.live("renders the sign-in screen from the catalog", () =>
    Effect.gen(function* rendersSignInCopy() {
      openAt("/sign-in", {});

      const heading = yield* appeared(() =>
        screen.getByRole("heading", { level: 2 })
      );

      yield* appeared(() => {
        expect(document.title).toBe(en.titles.signIn);
      });

      expect(heading.textContent).toBe(en.signIn.title);
      expect(screen.getByLabelText(en.signIn.email)).toBeDefined();
      expect(screen.getByLabelText(en.signIn.password)).toBeDefined();
      expect(
        screen.getByRole("button", { name: en.signIn.submit })
      ).toBeDefined();
      expect(
        screen.getByRole("link", { name: en.signIn.alternative })
      ).toBeDefined();
      expect(document.title).toBe("Sign in · Savour");
    })
  );
});
