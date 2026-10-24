import * as Y from "yjs";

import { applyOps, mint, type ApplyResult, type Op, type WidgetCatalog, type WorkflowJSON } from "../src/index.js";
import { appliedMap } from "../src/doc.js";

/**
 * The rejection oracle of record (`.agents/checks/convergence-idempotency.md`,
 * KA-4, D4): a rejected op leaves the document BYTE-identical, not merely
 * projection-identical. `project()` reads neither `__stamps` nor `__applied`,
 * so only `Y.encodeStateAsUpdate` can see a stray ledger write ahead of the
 * throw. The rejected op also never records its `op_id`, so re-submitting it
 * is re-attempted (and re-rejected) rather than deduped, which is what makes
 * the retry non-mutating too, the second half of #10.
 *
 * With `trailing`, it also gathers abort-remainder evidence: a valid op
 * batched after the rejected one must be reported `batch_aborted`, must not
 * apply, and must not record its `op_id` either.
 *
 * The evidence is returned rather than asserted here so the caller's test
 * holds the assertion: compare it to `cleanRejection(code)` with `toEqual`,
 * and a failure diff names the exact leg that broke.
 */
export interface RejectionEvidence {
  code: string | undefined;
  bytesUnchanged: boolean;
  opIdRecorded: boolean;
  retryCode: string | undefined;
  retryBytesUnchanged: boolean;
  batch?: {
    codes: string[];
    bytesUnchanged: boolean;
    opIdRecorded: boolean;
    trailingOpIdRecorded: boolean;
  };
}

function outcomeCodes(result: ApplyResult): string[] {
  return result.outcomes.map((outcome) => (outcome.outcome === "rejected" ? outcome.reason.code : outcome.outcome));
}

function firstRejectionCode(result: ApplyResult): string | undefined {
  const rejected = result.outcomes.find((outcome) => outcome.outcome === "rejected");
  return rejected?.outcome === "rejected" ? rejected.reason.code : undefined;
}

export function rejectionEvidence(
  workflow: WorkflowJSON,
  op: Op,
  withCatalog: WidgetCatalog,
  trailing?: Op,
): RejectionEvidence {
  const doc = mint(workflow, withCatalog);
  try {
    const before = Buffer.from(Y.encodeStateAsUpdate(doc));
    const unchanged = () => Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before);
    const code = firstRejectionCode(applyOps(doc, [op], withCatalog));
    const bytesUnchanged = unchanged();
    const opIdRecorded = appliedMap(doc).has(op.op_id);
    const retryCode = firstRejectionCode(applyOps(doc, [op], withCatalog));
    const evidence: RejectionEvidence = { code, bytesUnchanged, opIdRecorded, retryCode, retryBytesUnchanged: unchanged() };
    if (trailing !== undefined) {
      const codes = outcomeCodes(applyOps(doc, [op, trailing], withCatalog));
      evidence.batch = {
        codes,
        bytesUnchanged: unchanged(),
        opIdRecorded: appliedMap(doc).has(op.op_id),
        trailingOpIdRecorded: appliedMap(doc).has(trailing.op_id),
      };
    }
    return evidence;
  } finally {
    doc.destroy();
  }
}

/** The evidence a clean rejection with `code` produces. */
export function cleanRejection(code: string, withTrailing = false): RejectionEvidence {
  const evidence: RejectionEvidence = {
    code,
    bytesUnchanged: true,
    opIdRecorded: false,
    retryCode: code,
    retryBytesUnchanged: true,
  };
  if (withTrailing) {
    evidence.batch = { codes: [code, "batch_aborted"], bytesUnchanged: true, opIdRecorded: false, trailingOpIdRecorded: false };
  }
  return evidence;
}
