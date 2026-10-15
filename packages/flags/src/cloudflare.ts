import type { Flag, Flags } from "@savour/core/flags";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Namespace from "alchemy/Namespace";
import { retain } from "alchemy/RemovalPolicy";
import * as RuntimeContext from "alchemy/RuntimeContext";
import { Effect, Layer } from "effect";

import { kvFlagsLayer } from "./kv.js";

const flagsNamespace = Cloudflare.KV.Namespace("Store").pipe(
  retain(),
  Namespace.set("FeatureFlags")
);

export const cloudflareFlagsLayer = <E, R>(
  registry: readonly Flag<unknown>[],
  fallback: Layer.Layer<Flags, E, R>,
  deployOnly: readonly string[] = []
) =>
  Layer.unwrap(
    Effect.gen(function* declareCloudflareFlags() {
      const namespace = yield* flagsNamespace;
      const client = yield* Cloudflare.KV.ReadNamespace(namespace);

      const kv = {
        get: (key: string) =>
          client
            .get(key)
            .pipe(Effect.provide(RuntimeContext.RuntimeContext.phantom)),
      };

      return kvFlagsLayer(registry, kv, deployOnly).pipe(
        Layer.provide(fallback)
      );
    })
  ).pipe(Layer.provide(Cloudflare.KV.ReadNamespaceBinding));
