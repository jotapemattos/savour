import { Schema } from "effect";
import type { Nodes } from "mdast";

import {
  htmlPlainText,
  htmlTokens,
  parseContentMarkdown,
  visitContentNodes,
} from "./svx-ast.ts";

export const GroundingMap = Schema.Struct({
  claims: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      page: Schema.String,
      quote: Schema.String,
    })
  ),
  entries: Schema.Array(
    Schema.Struct({
      claims: Schema.Array(Schema.String),
      kind: Schema.Literals(["sentence", "cell", "label", "alt"]),
      text: Schema.String,
    })
  ),
});

export interface GroundingText {
  readonly kind: "sentence" | "cell" | "label" | "alt";
  readonly text: string;
}

const normalize = (text: string) => text.replaceAll(/\s+/gu, " ").trim();

const nodeText = (node: Nodes): string => {
  if ("children" in node) {
    return node.children.map(nodeText).join("");
  }

  return "value" in node ? node.value : "";
};

export const groundingTexts = (
  page: string,
  svgs: readonly string[]
): readonly GroundingText[] => {
  const texts: GroundingText[] = [];

  visitContentNodes(parseContentMarkdown(page), (node) => {
    if (node.type === "paragraph") {
      for (const sentence of nodeText(node).split(/(?<=[.!?])\s+/u)) {
        if (normalize(sentence) !== "") {
          texts.push({ kind: "sentence", text: normalize(sentence) });
        }
      }
    } else if (node.type === "tableCell") {
      texts.push({ kind: "cell", text: normalize(nodeText(node)) });
    } else if (node.type === "image") {
      texts.push({ kind: "alt", text: normalize(node.alt ?? "") });
    } else if (node.type === "html") {
      const prose = normalize(htmlPlainText(node.value));

      if (prose !== "") {
        for (const sentence of prose.split(/(?<=[.!?])\s+/u)) {
          texts.push({ kind: "sentence", text: normalize(sentence) });
        }
      }

      for (const token of htmlTokens(node.value)) {
        if (token.kind === "open" && token.name === "img") {
          texts.push({
            kind: "alt",
            text: normalize(token.attributes.alt ?? ""),
          });
        }
      }
    }
  });

  for (const svg of svgs) {
    const tokens = htmlTokens(svg);

    for (const [index, token] of tokens.entries()) {
      if (
        token.kind === "open" &&
        ["text", "title", "desc"].includes(token.name)
      ) {
        const closing = tokens
          .slice(index + 1)
          .find(
            (candidate) =>
              candidate.kind === "close" && candidate.name === token.name
          );

        texts.push({
          kind: "label",
          text: normalize(htmlPlainText(svg.slice(token.end, closing?.start))),
        });
      }
    }
  }

  return texts;
};

export const groundingFailures = (
  texts: readonly GroundingText[],
  map: typeof GroundingMap.Type
): readonly string[] => {
  const ids = new Set(map.claims.map((claim) => claim.id));

  return texts.flatMap(({ kind, text }) => {
    const entry =
      map.entries.find(
        (candidate) => candidate.kind === kind && candidate.text === text
      ) ??
      map.entries.find(
        (candidate) =>
          candidate.kind === "label" &&
          kind === "label" &&
          text !== "" &&
          ` ${candidate.text} `.includes(` ${text} `)
      );

    if (entry === undefined || entry.claims.length === 0) {
      return [`${kind}: ${text}: add a claim id to the grounding map`];
    }

    return entry.claims
      .filter((id) => !ids.has(id))
      .map((id) => `${kind}: ${text}: unknown claim ${id}`);
  });
};
