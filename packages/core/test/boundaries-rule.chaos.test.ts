// @effect-diagnostics nodeBuiltinImport:off -- These tests write temporary source fixtures and run the real oxlint binary against them.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

const lintWebLoader = (source: string) => {
  const directory = mkdtempSync(path.join(tmpdir(), "savour-web-fence-"));

  const fixtureDirectory = path.join(
    directory,
    "apps/web/src/routes/boundary-fixtures"
  );

  const config = path.join(directory, "oxlint.json");
  const file = path.join(fixtureDirectory, "fixture.ts");

  mkdirSync(fixtureDirectory, { recursive: true });
  writeFileSync(
    config,
    JSON.stringify({
      jsPlugins: [
        {
          name: "rat-stack-boundaries",
          specifier: path.join(repoRoot, "scripts/oxlint-plugin-boundaries.ts"),
        },
      ],
      rules: { "rat-stack-boundaries/no-web-domain-imports": "error" },
    })
  );
  writeFileSync(file, source);

  try {
    const result = spawnSync(
      path.join(repoRoot, "node_modules/.bin/oxlint"),
      ["-c", config, "--no-ignore", file],
      { cwd: repoRoot, encoding: "utf-8" }
    );

    return `${result.stdout}${result.stderr}`;
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
};

describe("web fence evasion", () => {
  it.each([
    [
      "an adapter through the app's #/ alias",
      'import * as d from "#/adapters/neon";\n\nexport const x = d;\n',
    ],
    [
      "a store through the app's #/ alias",
      'import * as d from "#/stores/visits";\n\nexport const x = d;\n',
    ],
    [
      "a handler through a relative climb into packages/core",
      'import * as d from "../../../../../packages/core/src/health-capabilities.ts";\n\nexport const x = d;\n',
    ],
    [
      "a handler through a dot segment after the contracts entry",
      'import * as d from "@savour/core/contracts/../health";\n\nexport const x = d;\n',
    ],
  ])("rejects %s", (_name, source) => {
    expect(lintWebLoader(source)).toContain(
      "rat-stack-boundaries(no-web-domain-imports)"
    );
  });
});
