import { Data } from "effect";

export class GoogleAccountNotCreated extends Data.TaggedError(
  "GoogleAccountNotCreated"
)<{
  readonly cause: unknown;
}> {}
