import type { PersonId } from "@savour/database";
import { Context } from "effect";

export class CurrentPerson extends Context.Service<CurrentPerson, PersonId>()(
  "@savour/auth/CurrentPerson"
) {}
