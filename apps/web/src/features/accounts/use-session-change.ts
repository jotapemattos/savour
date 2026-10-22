import { useMutation } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { Data, Effect, Match, Predicate, Schema } from "effect";

import { viewerQuery } from "#/client/account-session";
import type {
  SessionGateway,
  SessionOutcome,
  SessionRefusal,
  Viewer,
} from "#/client/account-session";
import type { Messages } from "#/i18n/en";

export class SessionUnreachable extends Data.TaggedError("SessionUnreachable")<{
  readonly cause: Error;
}> {}

export const failureMessage = (messages: Messages["session"], error: Error) =>
  Predicate.isTagged(error, "SchemaError")
    ? messages.invalidFields
    : messages.unreachable;

export const refusalMessage = (
  messages: Messages["session"],
  change: SessionOutcome | Viewer | undefined,
  reason: SessionRefusal
) =>
  Predicate.isTagged(change, "Refused") && change.reason === reason
    ? messages.refusals[reason]
    : undefined;

export const changedTo = (
  change: SessionOutcome | Viewer | undefined,
  tag: Viewer["_tag"]
) => Predicate.isTagged(change, tag);

export const decodedWith =
  <Input, Change>(
    schema: Schema.Codec<Input>,
    change: (session: SessionGateway, input: Input) => Promise<Change>
  ) =>
  // oxlint-disable-next-line typescript/promise-function-async -- TanStack Query runs mutation functions as native Promises.
  (session: SessionGateway, form: FormData) =>
    Effect.runPromise(
      Schema.decodeUnknownEffect(schema)(Object.fromEntries(form)).pipe(
        Effect.flatMap((input) =>
          Effect.tryPromise({
            catch: (cause) =>
              new SessionUnreachable({
                cause:
                  cause instanceof Error ? cause : new Error(String(cause)),
              }),
            // oxlint-disable-next-line typescript/promise-function-async -- Session changes are native Promises.
            try: () => change(session, input),
          })
        )
      )
    );

export const useSessionChange = <Input = void>(
  change: (
    session: SessionGateway,
    input: Input
  ) => Promise<SessionOutcome | Viewer>
) => {
  const context = useRouteContext({ from: "__root__" });

  return useMutation({
    // oxlint-disable-next-line typescript/promise-function-async -- TanStack Query runs mutation functions as native Promises.
    mutationFn: (input: Input) => change(context.session, input),
    onSuccess: (outcome) => {
      Match.value(outcome).pipe(
        Match.tag("Refused", () => null),
        Match.orElse((viewer) =>
          context.queryClient.setQueryData(
            viewerQuery(context.api).queryKey,
            viewer
          )
        )
      );
    },
  });
};
