/**
 * Amendment A23 — `widgets_values_named` stays coherent with the widget write.
 *
 * A22 taught `set_widget` to keep the duplicate-only `widgets_values_ordered`
 * passthrough register in step with the identity-keyed `widgets` map, and left
 * the sibling `widgets_values_named` register untouched. A consumer that reads
 * values back BY NAME — which is what that register is for — then restored the
 * pre-op value and silently reverted the write. The name register addresses the
 * FINAL occurrence of a name, so these cases split on exactly that: the final
 * occurrence follows the write, every earlier one must not (writing it there
 * would corrupt the final occurrence's value instead of fixing anything).
 *
 * Measured by `reports/jobs/op343-fe19717-currentrepair.md` in the in-app-agent
 * program repo, which fed cmp's literal projected output back through the
 * frontend's `LGraphNode.configure` and watched the agent's write disappear.
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  applyOps,
  mint,
  project,
  type SetWidgetOp,
  type SubgraphDefinition,
  type WidgetCatalog,
  type WorkflowJSON,
  type WorkflowNode,
} from "../src/index.js";

const catalog: WidgetCatalog = {
  types: {
    DuplicateWidgets: { widget_order: ["same", "same"] },
    TripleWidgets: { widget_order: ["same", "same", "same"] },
    UniqueWidgets: { widget_order: ["alpha", "beta"] },
    ProtoWidget: { widget_order: ["__proto__"] },
    Host: { widget_order: ["width"] },
  },
};

const first = { trim: { start_time: 1, duration: 2 } };
const second = { crop: { x: 1, y: 2 } };

let sequence = 0;
function envelope() {
  const counter = ++sequence;
  return {
    op_id: String(counter).padStart(32, "0"),
    actor: "agent:remote:1",
    base_version: counter,
    stamp: [counter, "agent:remote:1"] as [number, string],
  };
}

/** The fields a case varies, over a fresh creator-owned envelope. */
type WidgetWriteFields = Partial<SetWidgetOp> & Pick<SetWidgetOp, "node_id" | "widget" | "value">;

function write(fields: WidgetWriteFields): SetWidgetOp {
  return { op: "set_widget", ...envelope(), ...fields } as SetWidgetOp;
}

function applied(doc: Y.Doc, op: SetWidgetOp): void {
  expect(applyOps(doc, [op], catalog).outcomes).toEqual([{ op_id: op.op_id, outcome: "applied" }]);
}

function node(doc: Y.Doc, id = 1): WorkflowNode {
  const found = project(doc, catalog).nodes.find((n) => String(n.id) === String(id));
  expect(found).toBeDefined();
  return found!;
}

const duplicates = (named?: Record<string, unknown>): WorkflowJSON => ({
  nodes: [{
    id: 1,
    type: "DuplicateWidgets",
    widgets_values: [first, second],
    ...(named === undefined ? {} : { widgets_values_named: named }),
    widgets_values_ordered: [
      { name: "same", occurrence: 0, value: first },
      { name: "same", occurrence: 1, value: second },
    ],
  }],
  links: [],
});

const unique = (named: Record<string, unknown>): WorkflowJSON => ({
  nodes: [{ id: 1, type: "UniqueWidgets", widgets_values: ["a", "b"], widgets_values_named: named }],
  links: [],
});

describe("A23 — the named register follows an occurrence-addressed write", () => {
  it("updates a UNIQUE widget name, the case that has nothing to do with duplicates", () => {
    const doc = mint(unique({ alpha: "a", beta: "b" }), catalog);
    applied(doc, write({ node_id: 1, widget: "alpha", value: "after" }));

    const projected = node(doc);
    expect(projected.widgets_values).toEqual(["after", "b"]);
    expect(projected.widgets_values_named).toEqual({ alpha: "after", beta: "b" });
  });

  it("updates the FINAL occurrence of a repeated name, which is the one the register addresses", () => {
    const doc = mint(duplicates({ same: second }), catalog);
    const replacement = { crop: { x: 9 } };
    applied(doc, write({ node_id: 1, widget: "same", widget_occurrence: 1, value: replacement }));

    const projected = node(doc);
    expect(projected.widgets_values).toEqual([first, replacement]);
    expect(projected.widgets_values_ordered).toEqual([
      { name: "same", occurrence: 0, value: first },
      { name: "same", occurrence: 1, value: replacement },
    ]);
    expect(projected.widgets_values_named).toEqual({ same: replacement });
  });

  it("leaves the register alone for an EARLIER occurrence, whose value it does not hold", () => {
    const doc = mint(duplicates({ same: second }), catalog);
    const replacement = { trim: { start_time: 99 } };
    applied(doc, write({ node_id: 1, widget: "same", widget_occurrence: 0, value: replacement }));

    const projected = node(doc);
    expect(projected.widgets_values).toEqual([replacement, second]);
    // Still the FINAL occurrence's value: writing `replacement` here would
    // revert occurrence 1 for every name-addressed reader.
    expect(projected.widgets_values_named).toEqual({ same: second });
  });

  // Cardinality three, deliberately. With only TWO same-named widgets, "the
  // final occurrence" and "anything but the first" pick out the same widget,
  // so a two-widget fixture cannot tell the implemented predicate from that
  // weaker one. Three is where they first disagree: the middle occurrence is
  // neither the first nor the last.
  const triples = (named: Record<string, unknown>): WorkflowJSON => ({
    nodes: [{
      id: 1,
      type: "TripleWidgets",
      widgets_values: ["a", "b", "c"],
      widgets_values_named: named,
    }],
    links: [],
  });

  it("follows the LAST of three occurrences", () => {
    const doc = mint(triples({ same: "c" }), catalog);
    applied(doc, write({ node_id: 1, widget: "same", widget_occurrence: 2, value: "C" }));

    const projected = node(doc);
    expect(projected.widgets_values).toEqual(["a", "b", "C"]);
    expect(projected.widgets_values_named).toEqual({ same: "C" });
  });

  it("leaves the register alone for the MIDDLE of three occurrences", () => {
    const doc = mint(triples({ same: "c" }), catalog);
    applied(doc, write({ node_id: 1, widget: "same", widget_occurrence: 1, value: "B" }));

    const projected = node(doc);
    expect(projected.widgets_values).toEqual(["a", "B", "c"]);
    expect(projected.widgets_values_named).toEqual({ same: "c" });
  });

  it("invents no register for a node that carries none", () => {
    const doc = mint(duplicates(), catalog);
    applied(doc, write({ node_id: 1, widget: "same", widget_occurrence: 1, value: "x" }));

    const projected = node(doc);
    expect(projected.widgets_values).toEqual([first, "x"]);
    expect("widgets_values_named" in projected).toBe(false);
  });

  it("invents no ENTRY for a name its producer left out, and disturbs no sibling entry", () => {
    const doc = mint(unique({ beta: "b" }), catalog);
    applied(doc, write({ node_id: 1, widget: "alpha", value: "after" }));

    const projected = node(doc);
    expect(projected.widgets_values).toEqual(["after", "b"]);
    expect(projected.widgets_values_named).toEqual({ beta: "b" });
  });

  it("leaves the register alone when NO catalog resolves the layout, rather than guessing", () => {
    const doc = mint(duplicates({ same: second }), catalog);
    const op = write({ node_id: 1, widget: "same", widget_occurrence: 1, value: "unproven" });
    // Applied WITHOUT a catalog: `validateWidgetName` is skipped by design, and
    // finality is then unknowable, so the register must not move. Projection
    // afterwards is a pure read and may use the catalog.
    expect(applyOps(doc, [op]).outcomes).toEqual([{ op_id: op.op_id, outcome: "applied" }]);

    const projected = node(doc);
    expect(projected.widgets_values).toEqual([first, "unproven"]);
    expect(projected.widgets_values_named).toEqual({ same: second });
  });

  it("leaves the register alone for an UNSELECTED option's sub-widget, which has no projected position", () => {
    const comboCatalog = {
      types: {
        Enhancer: {
          widget_order: ["sharpen", "mode"],
          dynamic_combos: {
            mode: {
              default: "creative",
              options: {
                creative: { widgets: [], defaults: {} },
                faithful: { widgets: ["mode.detail"], defaults: { "mode.detail": 80 } },
              },
            },
          },
        },
      },
    } as unknown as WidgetCatalog;
    const doc = mint(
      {
        nodes: [{
          id: 1,
          type: "Enhancer",
          widgets_values: [0, "creative"],
          widgets_values_named: { sharpen: 0, mode: "creative", "mode.detail": 80 },
        }],
        links: [],
      } as unknown as WorkflowJSON,
      comboCatalog,
    );
    const op = write({ node_id: 1, widget: "mode.detail", value: 55 });
    expect(applyOps(doc, [op], comboCatalog).outcomes).toEqual([
      { op_id: op.op_id, outcome: "applied" },
    ]);

    const projected = project(doc, comboCatalog).nodes[0]!;
    expect(projected.widgets_values).toEqual([0, "creative"]);
    expect(projected.widgets_values_named).toEqual({ sharpen: 0, mode: "creative", "mode.detail": 80 });
  });

  it("refuses to reshape a register a foreign producer stored as an ARRAY", () => {
    // `Object.hasOwn(["before"], "0")` is true, so the name gate alone would
    // let this through and the spread would hand the consumer back an OBJECT
    // where its own document had an array. The shape gate is what stops that.
    const numericCatalog = { types: { Numeric: { widget_order: ["0"] } } } as unknown as WidgetCatalog;
    const doc = mint(
      {
        nodes: [{ id: 1, type: "Numeric", widgets_values: ["before"], widgets_values_named: ["before"] }],
        links: [],
      } as unknown as WorkflowJSON,
      numericCatalog,
    );
    const op = write({ node_id: 1, widget: "0", value: "after" });
    expect(applyOps(doc, [op], numericCatalog).outcomes).toEqual([
      { op_id: op.op_id, outcome: "applied" },
    ]);

    const projected = project(doc, numericCatalog).nodes[0]!;
    expect(projected.widgets_values).toEqual(["after"]);
    expect(projected.widgets_values_named).toEqual(["before"]);
  });

  it("stores a COPY, so a caller mutating the op's value afterwards cannot reach the document", () => {
    const doc = mint(unique({ alpha: "a", beta: "b" }), catalog);
    const value = { nested: { n: 1 } };
    applied(doc, write({ node_id: 1, widget: "alpha", value }));
    value.nested.n = 99;

    expect(node(doc).widgets_values_named).toEqual({ alpha: { nested: { n: 1 } }, beta: "b" });
  });

  it("writes `__proto__` as an OWN key and pollutes no prototype", () => {
    const named: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    named["__proto__"] = "before";
    const doc = mint(
      {
        nodes: [{ id: 1, type: "ProtoWidget", widgets_values: ["before"], widgets_values_named: named }],
        links: [],
      } as unknown as WorkflowJSON,
      catalog,
    );
    applied(doc, write({ node_id: 1, widget: "__proto__", value: "after" }));

    const register = node(doc).widgets_values_named as Record<string, unknown>;
    expect(Object.hasOwn(register, "__proto__")).toBe(true);
    expect(Object.getOwnPropertyDescriptor(register, "__proto__")?.value).toBe("after");
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(register)).not.toBe("after");
  });

  it("keeps the register coherent on an INTERIOR (subgraph-scoped) write", () => {
    const definitionId = "12345678-1234-4123-8123-123456789abc";
    const subgraph: SubgraphDefinition = {
      id: definitionId,
      name: "Duplicates",
      inputs: [],
      outputs: [],
      nodes: [{
        id: 10,
        type: "DuplicateWidgets",
        inputs: [],
        outputs: [],
        widgets_values: [first, second],
        widgets_values_named: { same: second },
      }],
      links: [],
    } as unknown as SubgraphDefinition;
    const doc = mint(
      {
        nodes: [{ id: 1, type: definitionId, widgets_values: [] }],
        links: [],
        definitions: { subgraphs: [subgraph] },
      } as unknown as WorkflowJSON,
      catalog,
    );
    const replacement = { crop: { x: 7 } };
    applied(doc, write({
      node_id: 10,
      path: [definitionId, "10"],
      inner_widget: "same",
      widget: "same",
      widget_occurrence: 1,
      value: replacement,
    } as WidgetWriteFields));

    const interior = (project(doc, catalog).definitions as {
      subgraphs: Array<{ nodes: WorkflowNode[] }>;
    }).subgraphs[0]!.nodes[0]!;
    expect(interior.widgets_values).toEqual([first, replacement]);
    expect(interior.widgets_values_named).toEqual({ same: replacement });
  });

  it("keeps the register coherent on a promoted HOST write that lands on the named path", () => {
    const doc = mint(
      {
        nodes: [{ id: 57, type: "Host", widgets_values: [1024], widgets_values_named: { width: 1024 } }],
        links: [],
      } as unknown as WorkflowJSON,
      catalog,
    );
    applied(doc, write({
      node_id: 57,
      widget: "width",
      value: 768,
      promoted: { value_index: 0, instance_path: ["57"], host_widgets_values: [1024] },
    } as WidgetWriteFields));

    const projected = node(doc, 57);
    expect(projected.widgets_values).toEqual([768]);
    expect(projected.widgets_values_named).toEqual({ width: 768 });
  });

  it("stays deterministic: byte-identical replay, and convergence in both arrival orders", () => {
    const seed = mint(duplicates({ same: second }), catalog);
    const op = write({ node_id: 1, widget: "same", widget_occurrence: 1, value: { winner: "one" } });
    applied(seed, op);
    const before = Y.encodeStateAsUpdate(seed);
    expect(applyOps(seed, [op], catalog).outcomes).toEqual([{ op_id: op.op_id, outcome: "no-op" }]);
    expect(Y.encodeStateAsUpdate(seed)).toEqual(before);

    const low = write({ node_id: 1, widget: "same", widget_occurrence: 1, value: { winner: false } });
    const high = write({ node_id: 1, widget: "same", widget_occurrence: 1, value: { winner: true } });
    const fork = (source: Y.Doc) => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, Y.encodeStateAsUpdate(source));
      return doc;
    };
    const base = mint(duplicates({ same: second }), catalog);
    const forward = fork(base);
    const reverse = fork(base);
    // Assert the OUTCOME sequences, not just the end state. Without this, a
    // `reverse` run whose trailing `low` was *rejected before mutation* would
    // leave `high`'s value in place and pass every assertion below — so the
    // convergence claim would hold over an arrival order that never happened.
    // An LWW drop and a rejection are the two readings this distinguishes.
    expect(applyOps(forward, [low, high], catalog).outcomes.map((o) => o.outcome))
      .toEqual(["applied", "applied"]);
    expect(applyOps(reverse, [high, low], catalog).outcomes.map((o) => o.outcome))
      .toEqual(["applied", "lww-dropped"]);

    expect(project(forward, catalog)).toEqual(project(reverse, catalog));
    expect(node(forward).widgets_values_named).toEqual({ same: { winner: true } });
  });
});
