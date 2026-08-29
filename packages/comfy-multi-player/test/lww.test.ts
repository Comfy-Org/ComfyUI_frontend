/**
 * LWW parity: the exact `[base_version, actor, op_id]` comparison of
 * op-vocabulary-v1.md §8.1 (code-point order, op_id tiebreak), pinned by
 * (a) comparator unit tests over the six recorded vectors + the freeze doc's
 * edge descriptions, and (b) applying every vector in BOTH orders and
 * asserting the recorded winner survives.
 */
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  applyOps,
  codePointCompare,
  compareStampKeys,
  mint,
  project,
  stampKey,
  type SetWidgetOp,
  type StampKey,
  type WorkflowNode,
} from "../src/index.js";
import { canonicalize, loadCatalog, loadLwwVectors } from "./helpers.js";

const catalog = loadCatalog();
const vectors = loadLwwVectors();

describe("compareStampKeys (freeze doc §8.1)", () => {
  it("picks the recorded winner for all six vectors", () => {
    for (const v of vectors.vectors) {
      const [a, b] = v.ops as [SetWidgetOp, SetWidgetOp];
      const cmp = compareStampKeys(stampKey(a), stampKey(b));
      const winner = cmp > 0 ? a.op_id : b.op_id;
      expect(winner, v.name).toBe(v.winner_op_id);
      expect(cmp, `${v.name}: distinct ops never compare equal`).not.toBe(0);
    }
  });

  it("compares base_version numerically, not lexicographically", () => {
    // "10" < "9" as strings — numeric comparison must say 10 > 9.
    const a: StampKey = [10, "alice", "a".repeat(32)];
    const b: StampKey = [9, "zed", "f".repeat(32)];
    expect(compareStampKeys(a, b)).toBe(1);
  });

  it("breaks base_version ties by actor before op_id", () => {
    const a: StampKey = [7, "bob", "0".repeat(32)];
    const b: StampKey = [7, "alice", "f".repeat(32)];
    expect(compareStampKeys(a, b)).toBe(1);
  });

  it("a strict prefix sorts before its extension (freeze §8.1)", () => {
    expect(codePointCompare("ab", "abc")).toBe(-1);
    expect(compareStampKeys([1, "ab", "x"], [1, "abc", "x"])).toBe(-1);
  });

  it("no locale, no case folding: 'Z' < 'a' by code point", () => {
    expect(codePointCompare("Z", "a")).toBe(-1);
  });

  it("compares by code point above the BMP (where UTF-16 unit order diverges)", () => {
    // U+1F600 (😀, surrogate pair d83d de00) vs U+FFFF: JS `<` on UTF-16 units
    // says "😀" < "￿"; Python code-point order says the opposite. Actors
    // are contractually ASCII, but the comparator must be code-point-true.
    expect("😀" < "￿").toBe(true); // the trap
    expect(codePointCompare("😀", "￿")).toBe(1); // the contract
  });

  it("equal keys compare equal (same op only)", () => {
    const k: StampKey = [3, "alice", "b".repeat(32)];
    expect(compareStampKeys(k, [...k] as StampKey)).toBe(0);
  });

  it("stampKey falls back to [base_version, actor] when stamp is absent", () => {
    const op = {
      op: "set_widget",
      op_id: "c".repeat(32),
      actor: "alice",
      base_version: 4,
      node_id: 1,
      widget: "steps",
      value: 1,
    } as unknown as SetWidgetOp;
    expect(stampKey(op)).toEqual([4, "alice", "c".repeat(32)]);
  });
});

describe("LWW vector application (both orders)", () => {
  function widgetValue(wf: ReturnType<typeof project>, v: (typeof vectors.vectors)[number]): unknown {
    const first = v.ops[0] as SetWidgetOp;
    if (first.path && first.path.length > 0) {
      const defs = (wf["definitions"] as { subgraphs: { nodes: WorkflowNode[] }[] }).subgraphs;
      const interiorId = first.path[first.path.length - 1]!;
      for (const sg of defs) {
        const node = sg.nodes.find((n) => String(n.id) === String(interiorId));
        if (node) {
          const order = catalog.types[node.type]!.widget_order;
          return (node.widgets_values as unknown[])[order.indexOf(first.inner_widget!)];
        }
      }
      throw new Error(`interior node ${interiorId} not found`);
    }
    const node = wf.nodes.find((n) => String(n.id) === String(first.node_id))!;
    const order = catalog.types[node.type]!.widget_order;
    return (node.widgets_values as unknown[])[order.indexOf(first.widget)];
  }

  for (const v of vectors.vectors) {
    it(`${v.name}: converges on '${String(v.converged_value)}' in both orders`, () => {
      const base = v.name.startsWith("subgraph")
        ? vectors.subgraph_base_workflow
        : vectors.base_workflow;
      // One common snapshot, two forks (schema §9) — never re-seed.
      const minted = mint(base, catalog);
      const snapshot = Y.encodeStateAsUpdate(minted);
      const fork = () => {
        const d = new Y.Doc();
        Y.applyUpdate(d, snapshot);
        return d;
      };

      const forward = fork();
      const reverse = fork();
      expect(applyOps(forward, v.ops, catalog).outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
      expect(applyOps(reverse, [...v.ops].reverse(), catalog).outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();

      const pf = project(forward, catalog);
      const pr = project(reverse, catalog);
      expect(widgetValue(pf, v), `${v.name} forward`).toEqual(v.converged_value);
      expect(widgetValue(pr, v), `${v.name} reverse`).toEqual(v.converged_value);
      // §2.5: projections byte-equal regardless of arrival order.
      expect(JSON.stringify(canonicalize(pf))).toBe(JSON.stringify(canonicalize(pr)));
    });
  }
});
