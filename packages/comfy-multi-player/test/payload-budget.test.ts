import { describe, expect, it } from "vitest";
import { MAX_OP_COST, opBoundsRefusal } from "../src/limits.js";

describe("payload budget accounting", () => {
  it.each([
    [1, (length: number) => "x".repeat(length)],
    [7, (length: number) => ({ a: "x".repeat(length) })],
  ] as const)("charges %i units of overhead at the inclusive cost boundary", (overhead, payload) => {
    expect(opBoundsRefusal(payload(MAX_OP_COST - overhead))).toBeNull();
    expect(opBoundsRefusal(payload(MAX_OP_COST - overhead + 1))).toBe(
      `payload exceeds the ${MAX_OP_COST}-unit cost budget (#14)`,
    );
  });

  it("charges repeated shared references independently, not as cycles", () => {
    // Array: 1 visit + 4 container. Each object: 1 visit + 4 container +
    // 1 key character + 1 string visit. Final empty string: 1 visit.
    // Total = 20 + 2 * string length, independently of traversal implementation.
    const shared = { a: "x".repeat((MAX_OP_COST - 20) / 2) };
    expect(opBoundsRefusal([shared, shared, ""])).toBeNull();
    shared.a += "x";
    expect(opBoundsRefusal([shared, shared, ""])).toBe(
      `payload exceeds the ${MAX_OP_COST}-unit cost budget (#14)`,
    );
  });
});
