#!/usr/bin/env bash
set -euo pipefail

step="starting"
tmp_parent="$(mktemp -d "${TMPDIR:-/tmp}/savour-acceptance.XXXXXX")"
tmp="$tmp_parent/clone"

cleanup() {
  local status=$?
  if [[ "${KEEP:-0}" == "1" ]]; then
    printf 'KEEP=1; preserved acceptance copy at %s\n' "$tmp_parent" >&2
  else
    rm -rf "$tmp_parent"
  fi
  exit "$status"
}
trap cleanup EXIT INT TERM

fail() {
  printf 'acceptance failed [%s]: %s\n' "$step" "$*" >&2
  exit 1
}

printf '== cold-clone acceptance ==\n'
if [[ $# -gt 0 ]]; then
  source_url="$1"
else
  repo_root="$(git rev-parse --show-toplevel)" || fail "could not find the repository root"
  source_url="file://${repo_root}"
fi
printf 'source: %s\n' "$source_url"

step="clone"
if ! git clone --depth 1 "$source_url" "$tmp"; then
  fail "git clone failed"
fi
cd "$tmp"
printf 'clone: %s\n' "$tmp"

step="cold install"
if ! pnpm install --frozen-lockfile; then
  fail "pnpm install --frozen-lockfile failed"
fi

step="rename workspace"
acceptance_scope="@acceptance-$((RANDOM * 32768 + RANDOM))"
replace_refs() {
  local file="$1"
  if sed --version >/dev/null 2>&1; then
    sed -i "s|@savour/|${acceptance_scope}/|g" "$file"
  else
    sed -i '' "s|@savour/|${acceptance_scope}/|g" "$file"
  fi
}
while IFS= read -r -d '' file; do
  replace_refs "$file"
done < <(
  rg --hidden --files-with-matches --null -F '@savour/' \
    -g '!.git/**' -g '!node_modules/**' -g '!.agent_sources/**' . || true
)
remaining="$(rg --hidden --files-with-matches -F '@savour/' \
  -g '!.git/**' -g '!node_modules/**' -g '!.agent_sources/**' . || true)"
if [[ -n "$remaining" ]]; then
  printf 'remaining @savour/ references:\n%s\n' "$remaining" >&2
  fail "workspace rename left old package references"
fi
printf 'renamed workspace scope to %s\n' "$acceptance_scope"

step="post-rename install"
if ! pnpm install --frozen-lockfile; then
  fail "pnpm install --frozen-lockfile failed after the workspace rename"
fi

step="build script type dependencies"
if ! pnpm --filter "${acceptance_scope}/capability" build; then
  fail "capability build failed before type-aware formatting"
fi

step="post-rename format"
if ! pnpm fix; then
  fail "pnpm fix failed after the workspace rename"
fi

step="add throwaway capability"
cat > packages/core/src/acceptance-probe.ts <<EOF
import { defineContract, implement } from "${acceptance_scope}/capability";
import { Effect, Schema } from "effect";

const acceptanceProbeContract = defineContract("acceptanceProbe", {
  annotations: { idempotent: true, readOnly: true },
  description: "Return a deterministic value for template acceptance tests",
  failure: Schema.Never,
  input: Schema.Struct({ value: Schema.String }),
  output: Schema.Struct({ value: Schema.String }),
});

export const acceptanceProbe = implement(
  acceptanceProbeContract,
  ({ value }) => Effect.succeed({ value })
);
EOF
if ! node --input-type=module <<'NODE'
import { readFile, writeFile } from "node:fs/promises";

const indexPath = "packages/core/src/index.ts";
const index = await readFile(indexPath, "utf8");
const imported = index.replace(
  'import { health } from "./health-capabilities.js";',
  'import { acceptanceProbe } from "./acceptance-probe.js";\nimport { health } from "./health-capabilities.js";'
);
if (imported === index) {
  throw new Error("add-a-capability import text did not match core/index.ts");
}
const registered = imported.replace(
  "export const capabilities = [",
  "export const capabilities = [acceptanceProbe, "
);
if (registered === imported) {
  throw new Error("add-a-capability registration text did not match core/index.ts");
}
await writeFile(indexPath, registered);
NODE
then
  fail "add-a-capability instructions did not match the scaffold"
fi
printf 'registered acceptanceProbe in packages/core/src/index.ts\n'

step="format acceptance probe"
if ! pnpm fix; then
  fail "pnpm fix failed after adding the throwaway capability"
fi

step="full gate"
if ! pnpm turbo run check test build; then
  fail "pnpm turbo run check test build failed"
fi

step="HTTP capability route"
openapi_body="$tmp/openapi.json"
if ! node --input-type=module -e 'const { http } = await import("./apps/api/dist/app.js"); console.log(JSON.stringify(http.openApi()));' >"$openapi_body" 2>&1; then
  cat "$openapi_body" >&2
  fail "could not print the api OpenAPI document"
fi
if ! grep -Fq '"/acceptanceProbe"' "$openapi_body"; then
  cat "$openapi_body" >&2
  fail "OpenAPI did not document /acceptanceProbe"
fi
printf 'HTTP: /acceptanceProbe appears in the api OpenAPI document\n'
printf 'cold-clone acceptance passed\n'
