#!/usr/bin/env node

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Approval } from "@savour/capability";
import { FlagActor } from "@savour/core/flag-control";
import { eventFlags, Flags } from "@savour/core/flags";
import { Effect, Layer } from "effect";

import { runCommand } from "./command.js";

const program = runCommand(process.argv.slice(2)).pipe(
  Effect.provideService(FlagActor, "local-cli"),
  Effect.provide(
    Layer.mergeAll(
      NodeServices.layer,
      Flags.defaults(eventFlags),
      Approval.denyAll
    )
  )
);

NodeRuntime.runMain(program);
