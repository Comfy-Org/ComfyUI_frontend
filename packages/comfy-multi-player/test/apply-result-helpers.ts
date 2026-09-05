import type { ApplyResult } from "../src/types.js";

export function rejectedOutcome(result: ApplyResult) {
  return result.outcomes.find(
    (outcome): outcome is Extract<ApplyResult["outcomes"][number], { outcome: "rejected" }> =>
      outcome.outcome === "rejected" && outcome.reason.code !== "batch_aborted",
  );
}

export function rejectedOutcomeWithIndex(result: ApplyResult) {
  const index = result.outcomes.findIndex((outcome) => outcome.outcome === "rejected");
  const outcome = result.outcomes[index];
  return outcome?.outcome === "rejected" ? { index, ...outcome.reason } : undefined;
}

export function appliedOpIds(result: ApplyResult): string[] {
  return result.outcomes.filter((outcome) => outcome.outcome === "applied").map((outcome) => outcome.op_id);
}

export function noOpIds(result: ApplyResult): string[] {
  return result.outcomes.filter((outcome) => outcome.outcome === "no-op").map((outcome) => outcome.op_id);
}

export function appliedCount(result: ApplyResult): number {
  return result.outcomes.filter((outcome) => outcome.outcome !== "rejected").length;
}
