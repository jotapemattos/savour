import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, FileSystem, Schema } from "effect";

import {
  GroundingMap,
  groundingFailures,
  groundingTexts,
} from "../scripts/content-grounding.ts";
import { frontmatterData, htmlTokens } from "../scripts/svx-ast.ts";
import {
  fixtureBytes,
  imageAssetPaths,
  loreSources,
} from "./generated-content.ts";

const loadGrounding = Effect.fnUntraced(function* loadGrounding() {
  const fs = yield* FileSystem.FileSystem;

  const page = yield* fs.readFileString(
    new URL(
      "../../../.brain/resources/lore/infrastructure-as-effects.svx",
      import.meta.url
    ).pathname
  );

  const map = yield* fs
    .readFileString(
      new URL(
        "../../../.brain/data/lore/infrastructure-as-effects.grounding.json",
        import.meta.url
      ).pathname
    )
    .pipe(
      Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(GroundingMap)))
    );

  const svgs = yield* Effect.forEach(["landscape", "portrait"], (orientation) =>
    fs.readFileString(
      new URL(
        `../content/infrastructure-as-effects/${orientation}.svg`,
        import.meta.url
      ).pathname
    )
  );

  return { map, page, svgs };
});

it.layer(NodeServices.layer)((test) => {
  test.effect(
    "requires claim ids for authored sentences, table cells, SVG labels and alt text",
    () =>
      Effect.gen(function* checkGrounding() {
        const { map, page, svgs } = yield* loadGrounding();
        expect(groundingFailures(groundingTexts(page, svgs), map)).toEqual([]);
      })
  );

  test.effect(
    "rejects ungrounded additions in each supported content form",
    () =>
      Effect.gen(function* rejectAdditions() {
        const { map, page, svgs } = yield* loadGrounding();

        const failures = groundingFailures(
          groundingTexts(
            `${page}\n\nThis invented sentence has no source.\n\n| Invented cell |\n| --- |\n\n<img src="/local.svg" alt="Invented alt" />`,
            [...svgs, "<svg><text>Invented <tspan>label</tspan></text></svg>"]
          ),
          map
        );

        expect(failures).toEqual([
          "sentence: This invented sentence has no source.: add a claim id to the grounding map",
          "cell: Invented cell: add a claim id to the grounding map",
          "alt: Invented alt: add a claim id to the grounding map",
          "label: Invented label: add a claim id to the grounding map",
        ]);
      })
  );

  test.effect(
    "keeps the rendered CAFE page's infrastructure prerequisite",
    () =>
      Effect.gen(function* checkCafePrerequisite() {
        const fs = yield* FileSystem.FileSystem;

        const cafe = yield* fs.readFileString(
          new URL(
            "../../../.brain/resources/lore/cafe-stack.svx",
            import.meta.url
          ).pathname
        );

        expect(frontmatterData(cafe).prerequisites).toContain(
          "lore.infrastructure-as-effects"
        );

        const rendered = loreSources.find(
          (source) => source.routePath === "/lore/cafe-stack"
        );

        expect(rendered?.documentHtml).toContain("<h1");
        expect(rendered?.documentHtml).toContain("Cloudflare");
      })
  );

  test.effect("refuses empty and unknown claim references", () =>
    Effect.gen(function* rejectReferences() {
      const { map } = yield* loadGrounding();
      const text = { kind: "sentence" as const, text: "Mapped sentence." };

      for (const claims of [[], ["missing-claim"]]) {
        expect(
          groundingFailures([text], {
            claims: map.claims,
            entries: [{ ...text, claims }],
          })
        ).toHaveLength(1);
      }
    })
  );
});

it("grounds split SVG captions and metadata without permitting prose fragments or partial words", () => {
  const text = "The compiler checks these relationships before deployment.";

  const map = {
    claims: [{ id: "c25", page: "source", quote: text }],
    entries: [{ claims: ["c25"], kind: "label" as const, text }],
  };

  const labels = groundingTexts("", [
    `<svg><title>${text}</title><desc>${text}</desc><text>The compiler checks</text><text>these relationships before deployment.</text></svg>`,
  ]);

  expect(labels).toHaveLength(4);
  expect(groundingFailures(labels, map)).toEqual([]);
  expect(
    groundingFailures([{ kind: "label", text: "The compiler checks" }], {
      claims: map.claims,
      entries: [
        ...map.entries,
        { claims: [], kind: "label", text: "The compiler checks" },
      ],
    })
  ).toHaveLength(1);
  expect(
    groundingFailures(
      [
        { kind: "label", text: "compiler che" },
        { kind: "label", text: "" },
        { kind: "sentence", text: "The compiler checks" },
      ],
      map
    )
  ).toHaveLength(3);
});

it("serves both responsive SVGs as assets and retains the picture in generated content", () => {
  for (const orientation of ["landscape", "portrait"]) {
    const path = `/lore/infrastructure-as-effects/${orientation}.svg`;
    expect(imageAssetPaths).toContain(path);
    expect(fixtureBytes(path).toString("utf-8")).toContain("<svg");
  }

  const pageSource = loreSources.find(
    (source) => source.routePath === "/lore/infrastructure-as-effects"
  );

  expect(pageSource).toBeDefined();

  const tokens = htmlTokens(pageSource?.documentHtml ?? "");
  expect(tokens.some((token) => token.name === "picture")).toBe(true);
  expect(
    tokens.find((token) => token.name === "source")?.attributes
  ).toMatchObject({
    height: "1290",
    media: "(max-width: 640px)",
    srcset: "/lore/infrastructure-as-effects/portrait.svg",
    width: "600",
  });
  expect(
    tokens.find((token) => token.name === "img")?.attributes
  ).toMatchObject({
    height: "720",
    src: "/lore/infrastructure-as-effects/landscape.svg",
    width: "1200",
  });
});
