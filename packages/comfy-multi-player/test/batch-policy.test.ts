/**
 * Batch policy: what "batchable" means, where it is enforced, and where it is
 * deliberately NOT enforced (issue #19).
 *
 * The normative rule is comfy-cli `docs/op-vocabulary-v1.md` §1/§1.5/§1.6, and
 * it names its own enforcement point: "Batchable = the kind is accepted by
 * `apply_specs` (the `workflow apply` / `workflow foreach` batch surface)".
 * `apply_specs` takes edit *specs* and MINTS ops; a spec batch containing
 * `clear` or `reset_doc` is rejected whole, before anything is minted.
 *
 * `applyOps` is the other surface: it replays already-minted ops, porting
 * `apply_op`, whose batch protocol is §4 abort-remainder with no kind
 * restriction. Gating `applyOps` on `BATCHABLE_OPS` would diverge from
 * `apply_op` (KA-3 — one implementation, golden-vector parity) and would
 * reject the `edit-heavy` conformance case, which `docs/portability.md`
 * requires every language runner to replay "in file order with no failures or
 * skips".
 *
 * These tests are the consumer that keeps `BATCHABLE_OPS` from being a dead
 * constant a reader assumes is enforced.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { appliedCount, appliedOpIds, rejectedOutcome, rejectedOutcomeWithIndex } from "./apply-result-helpers.js";
import {
  BATCHABLE_OPS,
  DEFERRED_OPS,
  FROZEN_OPS,
  applyOps,
  mint,
  project,
  type ClearOp,
  type Op,
  type SetWidgetOp,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";
import { loadCatalog, loadSession, sessionFiles } from "./helpers.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const batchable = new Set<string>(BATCHABLE_OPS);

/** The two kinds the vocabulary calls standalone-only (§1.5, §1.6). */
const STANDALONE_ONLY = ["clear", "reset_doc"];

const catalog: WidgetCatalog = { types: { Sampler: { widget_order: ["steps"] } } };
const base: WorkflowJSON = {
  nodes: [{ id: 1, type: "Sampler", widgets_values: [20] }],
  links: [],
  last_node_id: 1,
  last_link_id: 0,
};

function envelope(actor: string, baseVersion: number, opId: string) {
  return { op_id: opId, actor, base_version: baseVersion, stamp: [baseVersion, actor] as [number, string] };
}

describe("batch policy — the batchable set (vocabulary §1)", () => {
  it("is exactly the frozen vocabulary minus the standalone-only kinds", () => {
    const declared = [...FROZEN_OPS, ...DEFERRED_OPS];
    const excluded = declared.filter((kind) => !batchable.has(kind)).sort();
    expect(excluded).toEqual([...STANDALONE_ONLY].sort());
  });

  it("never lists a kind the vocabulary does not declare", () => {
    const declared = new Set<string>([...FROZEN_OPS, ...DEFERRED_OPS]);
    for (const kind of BATCHABLE_OPS) {
      expect(declared.has(kind), `BATCHABLE_OPS lists '${kind}', which is not a declared op kind`).toBe(true);
    }
  });

  it("agrees with the README op table's Batchable column", () => {
    // Mirrors comfy-cli's test_batchability_matches_apply_specs: the document
    // and the machine-readable constant must not drift apart silently.
    const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
    const rows = [...readme.matchAll(/^\|\s*`(\w+)`\s*\|.*\|\s*(yes|no)\s*\|\s*$/gm)];
    expect(rows.length, "README op table rows").toBe(FROZEN_OPS.length + DEFERRED_OPS.length);
    const documented = rows.filter(([, , mark]) => mark === "yes").map(([, kind]) => kind!);
    expect(documented.sort()).toEqual([...BATCHABLE_OPS].sort());
  });
});

describe("batch policy — the replay surface deliberately does not gate on it (issue #19)", () => {
  it("applies a non-batchable `clear` inside a multi-op batch, matching apply_op", () => {
    const doc = mint(base, catalog);
    const ops: Op[] = [
      { op: "set_widget", ...envelope("human:u1:tab1", 1, "1".repeat(32)), node_id: 1, widget: "steps", value: 30 } as SetWidgetOp,
      { op: "clear", ...envelope("human:u1:tab1", 2, "2".repeat(32)), removed_nodes: [1] } as ClearOp,
      {
        op: "add_node",
        ...envelope("human:u1:tab1", 3, "3".repeat(32)),
        node_id: 2,
        class_type: "Sampler",
        pos: [0, 0],
        node: { id: 2, type: "Sampler", widgets_values: [8] },
      } as Op,
    ];

    const result = applyOps(doc, ops, catalog);

    // If this goes red because dispatch now rejects a non-batchable op, that is
    // NOT a bug fix: "batchable" is an authoring-surface rule (`apply_specs`),
    // the replay surface (`apply_op`) has no kind restriction, and enforcing it
    // here breaks the golden-vector parity contract. See issue #19.
    expect(rejectedOutcome(result)).toBeUndefined();
    expect(appliedCount(result)).toBe(3);
    expect(appliedOpIds(result)).toEqual(ops.map((o) => o.op_id));
    // The clear really ran: only the post-clear node survives.
    expect(project(doc, catalog).nodes.map((n) => String(n.id))).toEqual(["2"]);
  });

  it("keeps abort-remainder, not whole-batch atomicity, as the failure rule", () => {
    // apply_specs discards the whole batch; applyOps must not — §4 abort-remainder
    // retains the applied prefix. Pinned here so "make batches atomic like
    // apply_specs" is recognized as the second half of the same conflation.
    const doc = mint(base, catalog);
    const ops: Op[] = [
      { op: "clear", ...envelope("human:u1:tab1", 1, "4".repeat(32)), removed_nodes: [1] } as ClearOp,
      { op: "nonsense", ...envelope("human:u1:tab1", 2, "5".repeat(32)) } as unknown as Op,
      { op: "clear", ...envelope("human:u1:tab1", 3, "6".repeat(32)), removed_nodes: [] } as ClearOp,
    ];

    const result = applyOps(doc, ops, catalog);

    expect(rejectedOutcomeWithIndex(result)?.index).toBe(1);
    expect(rejectedOutcome(result)?.reason.code).toBe("unknown_op");
    expect(appliedOpIds(result)).toEqual(["4".repeat(32)]); // prefix retained, remainder not applied
  });
});

describe("batch policy — the conformance corpus is the compatibility constraint", () => {
  it("ships a session whose single applyOps call carries a non-batchable op mid-stream", () => {
    const withNonBatchable = sessionFiles()
      .map((file) => loadSession(file))
      .filter(({ ops }) => ops.length > 1 && ops.some((op) => !batchable.has(op.op)));

    // test/replay.test.ts feeds each session to ONE applyOps call and requires
    // `failed === null`, so this corpus fact is exactly what a dispatch-level
    // batchable gate would break. Losing it would make the non-enforcement
    // above look free.
    expect(withNonBatchable.length, "sessions exercising a non-batchable op inside a multi-op batch").toBeGreaterThan(
      0,
    );

    for (const { file, ops } of withNonBatchable) {
      const index = ops.findIndex((op) => !batchable.has(op.op));
      expect(index, `${file}: the non-batchable op must be interior, not a standalone leading op`).toBeGreaterThan(0);
      expect(index, `${file}: the non-batchable op must be interior, not a standalone trailing op`).toBeLessThan(
        ops.length - 1,
      );
    }
  });

  it("replays such a session through one applyOps call with no failure", () => {
    const catalogFixture = loadCatalog();
    const session = sessionFiles()
      .map((file) => loadSession(file))
      .find(({ ops }) => ops.length > 1 && ops.some((op) => !batchable.has(op.op)));
    expect(session, "a session with an interior non-batchable op").toBeDefined();

    const doc = mint(session!.header.base_workflow, catalogFixture);
    const result = applyOps(doc, session!.ops, catalogFixture);
    expect(rejectedOutcome(result)).toBeUndefined();
    expect(appliedCount(result)).toBe(session!.ops.length);
  });
});
