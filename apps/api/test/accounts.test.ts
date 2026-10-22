import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  AccountReport,
  Database,
  EmailTaken,
  HandleTaken,
  InvalidCredentials,
  SignedIn,
  SignedOut,
  Unauthenticated,
  signUpContract,
  signedInNextActions,
  signedOutNextActions,
} from "@savour/core";
import { Effect, Layer, Schema } from "effect";
import { HttpBody, HttpClient, HttpRouter } from "effect/http";

import { apiRoutes } from "../src/app.js";
import { FakePlaceSearch } from "./fixtures/fake-place-search.js";
import { MemoryAccounts, withTestRuntime } from "./fixtures/memory-accounts.js";
import { memoryVisits } from "./fixtures/memory-visits.js";
import { MemoryWantToGo } from "./fixtures/memory-want-to-go.js";
import { uniqueMemoryAccounts } from "./fixtures/unique-memory-accounts.js";

const ana = {
  email: "ana@example.test",
  handle: "ana",
  password: "correct horse 9",
};

const serveWith = (accounts: typeof MemoryAccounts) =>
  HttpRouter.serve(
    apiRoutes.pipe(
      Layer.provide(accounts),
      Layer.provide(FakePlaceSearch),
      Layer.provide(memoryVisits().layer),
      Layer.provide(MemoryWantToGo),
      Layer.provide(
        Layer.succeed(Database, { selectOne: Effect.succeed<1>(1) })
      )
    ),
    { disableListenLog: true, disableLogger: true }
  ).pipe(Layer.provideMerge(NodeHttpServer.layerTest), withTestRuntime);

const ServedApi = serveWith(MemoryAccounts);

const postJson = (path: string, body: Record<string, string>) =>
  HttpClient.post(path, { body: HttpBody.jsonUnsafe(body) });

const withBearer = (token: string) => ({
  headers: { authorization: `Bearer ${token}` },
});

const decodeSignedIn = Schema.decodeUnknownEffect(SignedIn);

const signUpAna = Effect.gen(function* signUpAna() {
  const response = yield* postJson("/accounts", ana);

  expect(response.status).toBe(200);

  return yield* decodeSignedIn(yield* response.json);
});

describe("accounts", () => {
  it.effect("signs up with email, password and handle", () =>
    Effect.gen(function* signsUp() {
      const signedIn = yield* signUpAna;

      expect(signedIn.account).toStrictEqual({
        email: "ana@example.test",
        handle: "ana",
      });
      expect(signedIn.session.token).not.toBe("");
      expect(signedIn.next).toStrictEqual(signedInNextActions);
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("signs in with the same credentials", () =>
    Effect.gen(function* signsIn() {
      yield* signUpAna;

      const response = yield* postJson("/sessions", {
        email: ana.email,
        password: ana.password,
      });

      expect(response.status).toBe(200);

      const signedIn = yield* decodeSignedIn(yield* response.json);

      expect(signedIn.account.handle).toBe("ana");
      expect(signedIn.session.token).not.toBe("");
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("rejects a duplicate handle", () =>
    Effect.gen(function* rejectsDuplicateHandle() {
      yield* signUpAna;

      const response = yield* postJson("/accounts", {
        ...ana,
        email: "other@example.test",
      });

      expect(response.status).toBe(409);
      expect(
        yield* Schema.decodeUnknownEffect(HandleTaken)(yield* response.json)
      ).toStrictEqual(new HandleTaken({ handle: "ana" }));

      const otherSignIn = yield* postJson("/sessions", {
        email: "other@example.test",
        password: ana.password,
      });

      expect(otherSignIn.status).toBe(401);
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("rejects a duplicate email", () =>
    Effect.gen(function* rejectsDuplicateEmail() {
      yield* signUpAna;

      const response = yield* postJson("/accounts", {
        ...ana,
        handle: "ana_two",
      });

      expect(response.status).toBe(409);
      expect(
        yield* Schema.decodeUnknownEffect(EmailTaken)(yield* response.json)
      ).toStrictEqual(new EmailTaken());
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("rejects wrong password with a typed failure", () =>
    Effect.gen(function* rejectsWrongPassword() {
      yield* signUpAna;

      const response = yield* postJson("/sessions", {
        email: ana.email,
        password: "wrong",
      });

      const body = yield* response.json;

      expect(response.status).toBe(401);
      expect(
        yield* Schema.decodeUnknownEffect(InvalidCredentials)(body)
      ).toStrictEqual(new InvalidCredentials());
      expect(JSON.stringify(body)).not.toContain("token");
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("rejects a handle outside the handle rules", () =>
    Effect.gen(function* rejectsBadHandle() {
      const response = yield* postJson("/accounts", { ...ana, handle: "Ana!" });

      expect(response.status).toBe(400);
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("needs no invite code", () =>
    Effect.gen(function* needsNoInvite() {
      expect(Object.keys(signUpContract.input.fields).toSorted()).toStrictEqual(
        ["email", "handle", "password"]
      );

      yield* signUpAna;
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("reads and ends the current session over HTTP", () =>
    Effect.gen(function* readsAndEndsSession() {
      const { session } = yield* signUpAna;

      const current = yield* HttpClient.get(
        "/account",
        withBearer(session.token)
      );

      expect(current.status).toBe(200);
      expect(
        yield* Schema.decodeUnknownEffect(AccountReport)(yield* current.json)
      ).toStrictEqual({
        account: { email: "ana@example.test", handle: "ana" },
        next: signedInNextActions,
      });

      const signedOut = yield* HttpClient.del(
        "/sessions/current",
        withBearer(session.token)
      );

      expect(signedOut.status).toBe(200);
      expect(
        yield* Schema.decodeUnknownEffect(SignedOut)(yield* signedOut.json)
      ).toStrictEqual({ next: signedOutNextActions });

      const afterSignOut = yield* HttpClient.get(
        "/account",
        withBearer(session.token)
      );

      expect(afterSignOut.status).toBe(401);
      expect(
        yield* Schema.decodeUnknownEffect(Unauthenticated)(
          yield* afterSignOut.json
        )
      ).toStrictEqual(new Unauthenticated());
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("answers 401 Unauthenticated without a bearer token", () =>
    Effect.gen(function* rejectsAnonymous() {
      const response = yield* HttpClient.get("/account");

      expect(response.status).toBe(401);
    }).pipe(Effect.provide(ServedApi))
  );
});

describe("simultaneous sign-ups", () => {
  it.effect(
    "answers HandleTaken when the handle was claimed between check and insert",
    () =>
      Effect.gen(function* answersHandleTaken() {
        const response = yield* postJson("/accounts", ana);

        expect(response.status).toBe(409);
        expect(
          yield* Schema.decodeUnknownEffect(HandleTaken)(yield* response.json)
        ).toStrictEqual(new HandleTaken({ handle: "ana" }));
      }).pipe(
        Effect.provide(
          serveWith(
            uniqueMemoryAccounts({
              claimedFirst: { email: "other@example.test", handle: "ana" },
            })
          )
        )
      )
  );

  it.effect(
    "answers EmailTaken when the email was claimed between check and insert",
    () =>
      Effect.gen(function* answersEmailTaken() {
        const response = yield* postJson("/accounts", {
          ...ana,
          handle: "ana_two",
        });

        expect(response.status).toBe(409);
        expect(
          yield* Schema.decodeUnknownEffect(EmailTaken)(yield* response.json)
        ).toStrictEqual(new EmailTaken());
      }).pipe(
        Effect.provide(
          serveWith(
            uniqueMemoryAccounts({
              claimedFirst: {
                email: "ana@example.test",
                handle: "someone_else",
              },
            })
          )
        )
      )
  );

  it.effect("still crashes on an insert failure with neither explanation", () =>
    Effect.gen(function* crashesOnBrokenInsert() {
      const response = yield* postJson("/accounts", ana);

      expect(response.status).toBe(500);
    }).pipe(
      Effect.provide(serveWith(uniqueMemoryAccounts({ insertBreaks: true })))
    )
  );

  it.effect(
    "creates exactly one account when two sign-ups race for one handle",
    () =>
      Effect.gen(function* createsOneAccount() {
        const responses = yield* Effect.all(
          [
            postJson("/accounts", ana),
            postJson("/accounts", { ...ana, email: "other@example.test" }),
          ],
          { concurrency: "unbounded" }
        );

        expect(
          responses
            .map((response) => response.status)
            .toSorted((left, right) => left - right)
        ).toStrictEqual([200, 409]);

        const rejected = responses.find((response) => response.status === 409);

        expect(
          yield* Schema.decodeUnknownEffect(HandleTaken)(
            yield* rejected?.json ?? Effect.succeed(null)
          )
        ).toStrictEqual(new HandleTaken({ handle: "ana" }));
      }).pipe(Effect.provide(serveWith(uniqueMemoryAccounts({}))))
  );
});
