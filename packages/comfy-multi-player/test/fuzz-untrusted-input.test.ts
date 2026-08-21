/**
 * Fuzz taxonomy: untrusted op envelopes and node payloads (#13, #14).
 *
 * The saved corpus below carries two kinds of case. `#13` cases are live
 * assertions: the untrusted-node-input guard has landed, so those payloads are
 * rejected before any mutation. `#14` cases stay pinned with `it.fails` — the
 * payload size/depth/cost bounds do not exist yet, and the pin is what tells us
 * the day they do.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as fc from "fast-check";
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  DEFERRED_OPS,
  FROZEN_OPS,
  applyOps,
  mint,
  project,
  type Op,
  type WorkflowJSON,
} from "../src/index.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const FC_OPTIONS = { seed: 0x13_14_cafe, numRuns: 250 } as const;
const emptyWorkflow: WorkflowJSON = { nodes: [], links: [] };

function bytes(doc: Y.Doc): Buffer {
  return Buffer.from(Y.encodeStateAsUpdate(doc));
}

const malformedEnvelopeArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.constant(null),
  fc.integer(),
  fc.string(),
  fc.record({ op: fc.oneof(fc.integer(), fc.constant(null), fc.boolean()), op_id: fc.anything() }),
  fc.record({
    // Derived from the vocabulary constants, not re-typed: a new op kind is
    // fuzzed automatically instead of silently escaping this arbitrary (#21).
    op: fc.constantFrom<string>(...FROZEN_OPS, ...DEFERRED_OPS, "garbage"),
    op_id: fc.oneof(fc.constant(""), fc.integer(), fc.constant(null), fc.boolean()),
    actor: fc.oneof(fc.string(), fc.constant(null), fc.integer()),
    base_version: fc.oneof(fc.integer(), fc.double({ noNaN: false, noDefaultInfinity: false }), fc.string()),
    stamp: fc.anything(),
    payload: fc.anything({ maxDepth: 4 }),
  }),
);

describe("fuzz: malformed and adversarial op envelopes", () => {
  it("rejects structurally invalid ops loudly, without throwing or changing bytes", () => {
    fc.assert(
      fc.property(malformedEnvelopeArb, (input) => {
        const doc = mint(emptyWorkflow, catalog);
        const before = bytes(doc);
        let result: ReturnType<typeof applyOps> | undefined;

        expect(() => {
          result = applyOps(doc, [input as Op], catalog);
        }).not.toThrow();
        expect(result?.failed).not.toBeNull();
        expect(result?.applied).toEqual([]);
        expect(bytes(doc).equals(before)).toBe(true);
      }),
      FC_OPTIONS,
    );
  });

  it("project never throws after accepted add_node ops with JSON payloads, nulls, and non-ASCII actors", () => {
    const valueArb = fc.jsonValue({ maxDepth: 5 });
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), valueArb, fc.integer({ min: 1, max: 1_000_000 }), (actor, value, id) => {
        const doc = mint(emptyWorkflow, catalog);
        const op = {
          op: "add_node",
          op_id: id.toString(16).padStart(32, "0"),
          actor: `攻撃者\u0000${actor}`,
          base_version: 0,
          stamp: [0, `攻撃者\u0000${actor}`],
          node_id: id,
          class_type: "KSampler",
          pos: [0, 0],
          node: { id, type: "KSampler", widgets_values: [], fuzz_payload: value },
        } as unknown as Op;

        const result = applyOps(doc, [op], catalog);
        if (result.failed === null) expect(() => project(doc, catalog)).not.toThrow();
      }),
      FC_OPTIONS,
    );
  });

  it("project never throws after accepted NaN/Infinity widget values", () => {
    fc.assert(
      fc.property(fc.constantFrom(Number.NaN, Infinity, -Infinity), (value) => {
        const base: WorkflowJSON = {
          nodes: [{ id: 1, type: "KSampler", widgets_values: [] }],
          links: [],
        };
        const doc = mint(base, catalog);
        const op = {
          op: "set_widget",
          op_id: "f".repeat(32),
          actor: "非ASCII",
          base_version: 1,
          stamp: [1, "非ASCII"],
          node_id: 1,
          widget: "steps",
          value,
        } as Op;
        expect(applyOps(doc, [op], catalog).failed).toBeNull();
        expect(() => project(doc, catalog)).not.toThrow();
      }),
      FC_OPTIONS,
    );
  });

  it("duplicate op_id is an idempotent byte-level no-op even with adversarial retry payload", () => {
    const base: WorkflowJSON = {
      nodes: [{ id: 1, type: "KSampler", widgets_values: [] }],
      links: [],
    };
    const doc = mint(base, catalog);
    const first = {
      op: "set_widget",
      op_id: "d".repeat(32),
      actor: "first",
      base_version: 1,
      stamp: [1, "first"],
      node_id: 1,
      widget: "steps",
      value: 20,
    } as Op;
    expect(applyOps(doc, [first], catalog).failed).toBeNull();
    const before = bytes(doc);
    const retry = { ...first, actor: "攻撃者\u0000", value: new Array(10_000).fill(null) } as Op;

    const result = applyOps(doc, [retry], catalog);
    expect(result.failed).toBeNull();
    expect(result.skipped).toEqual([first.op_id]);
    expect(bytes(doc).equals(before)).toBe(true);
    expect(() => project(doc, catalog)).not.toThrow();
  });
});

interface CorpusCase {
  name: string;
  issue: 13 | 14;
  op: Op;
}

const corpusDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "fuzz", "untrusted-input");
const corpus = readdirSync(corpusDir)
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) => JSON.parse(readFileSync(join(corpusDir, file), "utf8")) as CorpusCase);

describe("saved untrusted-input regression corpus", () => {
  function rejectedBeforeMutation(entry: CorpusCase): void {
    const base: WorkflowJSON = {
      nodes: [{ id: 1, type: "KSampler", widgets_values: [] }],
      links: [],
    };
    const doc = mint(base, catalog);
    const before = bytes(doc);
    const result = applyOps(doc, [entry.op], catalog);

    expect(result.failed).not.toBeNull();
    expect(result.applied).toEqual([]);
    expect(bytes(doc).equals(before)).toBe(true);
    expect(() => project(doc, catalog)).not.toThrow();
  }

  for (const entry of corpus) {
    if (entry.issue === 13) {
      // #13 guard landed: the applier rejects these payloads before any write.
      it(`#13: ${entry.name} is rejected before mutation`, () => {
        rejectedBeforeMutation(entry);
      });
      continue;
    }
    // pins #14 — remove .fails once the payload size/depth/cost bounds land
    it.fails(`#${entry.issue}: ${entry.name} is rejected before mutation`, () => {
      rejectedBeforeMutation(entry);
    });
  }

  // Cycles cannot be represented in the JSON corpus. Keep this deterministic
  // reproducer beside it until #14 adds depth/shape bounds.
  // pins #14 — remove .fails once the payload size/depth/cost bounds land
  it.fails("#14: cyclic-ish node payload is rejected before cloning/storage", () => {
    const cycle: Record<string, unknown> = {};
    cycle["self"] = cycle;
    const doc = mint(emptyWorkflow, catalog);
    const before = bytes(doc);
    const op = {
      op: "add_node",
      op_id: "14000000000000000000000000000002",
      actor: "attacker",
      base_version: 0,
      stamp: [0, "attacker"],
      node_id: 99,
      class_type: "KSampler",
      pos: [0, 0],
      node: { id: 99, type: "KSampler", widgets_values: [], cycle },
    } as unknown as Op;

    const result = applyOps(doc, [op], catalog);
    expect(result.failed).not.toBeNull();
    expect(result.applied).toEqual([]);
    expect(bytes(doc).equals(before)).toBe(true);
  });

  // pins #14 — remove .fails once the payload size/depth/cost bounds land
  it.fails("#14: deeply nested and huge payloads are rejected before cloning/storage", () => {
    let deep: unknown = "leaf";
    for (let depth = 0; depth < 256; depth++) deep = { child: deep };
    const doc = mint(emptyWorkflow, catalog);
    const before = bytes(doc);
    const op = {
      op: "add_node",
      op_id: "14000000000000000000000000000003",
      actor: "attacker",
      base_version: 0,
      stamp: [0, "attacker"],
      node_id: 100,
      class_type: "KSampler",
      pos: [0, 0],
      node: {
        id: 100,
        type: "KSampler",
        widgets_values: [],
        deep,
        huge: new Array(100_000).fill("payload"),
      },
    } as unknown as Op;

    const result = applyOps(doc, [op], catalog);
    expect(result.failed).not.toBeNull();
    expect(result.applied).toEqual([]);
    expect(bytes(doc).equals(before)).toBe(true);
  });
});
