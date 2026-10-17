import { Context } from "effect";
import type { Option } from "effect";

export class SessionCredential extends Context.Service<
  SessionCredential,
  Option.Option<string>
>()("@savour/core/SessionCredential") {}
