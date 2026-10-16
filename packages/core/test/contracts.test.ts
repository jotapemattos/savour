import { describe, expect, it } from "vitest";

import { contracts } from "../src/contracts.js";
import { capabilities } from "../src/index.js";

describe("browser-safe contracts entry", () => {
  it("lists the contract of every capability, in order", () => {
    expect(contracts).toStrictEqual(
      capabilities.map((capability) => capability.contract)
    );
  });
});
