import { describe, expect, it } from "vitest";
import type { ApplyResult } from "../src/types.js";
import { noOpIds, rejectedOutcome } from "./apply-result-helpers.js";

describe("ApplyResult helpers", () => {
  it("returns the substantive rejection when an aborted outcome precedes it", () => {
    const result: ApplyResult = {
      outcomes: [
        {
          op_id: "aborted",
          outcome: "rejected",
          reason: { code: "batch_aborted", message: "not processed" },
        },
        {
          op_id: "failed",
          outcome: "rejected",
          reason: { code: "unknown_widget", message: "missing widget" },
        },
      ],
      ops_seen: 0,
    };

    expect(rejectedOutcome(result)).toEqual(result.outcomes[1]);
  });

  it("returns no substantive rejection for an aborted-only result", () => {
    const result: ApplyResult = {
      outcomes: [
        {
          op_id: "aborted",
          outcome: "rejected",
          reason: { code: "batch_aborted", message: "not processed" },
        },
      ],
      ops_seen: 0,
    };

    expect(rejectedOutcome(result)).toBeUndefined();
  });

  it("reports successful no-op ids without treating them as rejections", () => {
    const result: ApplyResult = {
      outcomes: [{ op_id: "duplicate", outcome: "no-op" }],
      ops_seen: 1,
    };

    expect(rejectedOutcome(result)).toBeUndefined();
    expect(noOpIds(result)).toEqual(["duplicate"]);
  });
});
