import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createNodeMap, initDoc } from "../src/doc.js";
import {
  nodesMap,
  type WidgetCatalog,
  type WorkflowJSON,
  mint,
  project,
  writeTarget,
} from "../src/index.js";

// Targeted edge/error-branch coverage for paths the existing suite leaves
// uncovered (measured via v8): stamps.writeTarget default arm, mint reserved-key
// and definitions validation + subgraph minting, and project's catalog-mismatch
// throws + string-id ordering. These are all public-surface behaviors.

const CAT = (types: WidgetCatalog["types"]): WidgetCatalog => ({ types });

describe("writeTarget — default arm (schema §3 stamp targets)", () => {
  it("returns [op.op] for op kinds without a specific write target", () => {
    // `clear` and `reset_doc` are frozen op kinds that hit the switch default.
    expect(writeTarget({ op: "clear", ids: [] } as never)).toEqual(["clear"]);
    expect(writeTarget({ op: "reset_doc" } as never)).toEqual(["reset_doc"]);
  });

  it("still targets the specific arms it knows", () => {
    expect(writeTarget({ op: "add_node", node_id: 7 } as never)).toEqual(["node", "7"]);
    expect(writeTarget({ op: "delete_node", node_id: 7 } as never)).toEqual(["node", "7"]);
  });
});

describe("mint — reserved / dunder meta-key collisions throw", () => {
  it("rejects a top-level key colliding with a reserved doc-meta key", () => {
    const wf = { nodes: [], links: [], schema_version: 99 } as unknown as WorkflowJSON;
    expect(() => mint(wf, CAT({}))).toThrow(/reserved doc-meta key/);
  });

  it("rejects a top-level key beginning with __", () => {
    const wf = { nodes: [], links: [], __smuggled: 1 } as unknown as WorkflowJSON;
    expect(() => mint(wf, CAT({}))).toThrow(/reserved doc-meta key/);
  });
});

describe("mint — definitions validation", () => {
  it("throws when workflow.definitions is an array", () => {
    const wf = { nodes: [], links: [], definitions: [] } as unknown as WorkflowJSON;
    expect(() => mint(wf, CAT({}))).toThrow(/definitions must be an object/);
  });

  it("throws when workflow.definitions is a scalar", () => {
    const wf = { nodes: [], links: [], definitions: "nope" } as unknown as WorkflowJSON;
    expect(() => mint(wf, CAT({}))).toThrow(/definitions must be an object/);
  });

  it("ignores an explicitly null definitions", () => {
    const wf = { nodes: [], links: [], definitions: null } as unknown as WorkflowJSON;
    expect(() => mint(wf, CAT({}))).not.toThrow();
  });
});

describe("mint + project — subgraph definition round-trip", () => {
  it("mints and projects a subgraph's interior nodes/links in mint order", () => {
    const catalog = CAT({ CLIPTextEncode: { widget_order: ["text"] } });
    const wf = {
      nodes: [],
      links: [],
      definitions: {
        subgraphs: [
          {
            id: "sg1",
            nodes: [
              { id: 2, type: "CLIPTextEncode", widgets_values: ["b"] },
              { id: 1, type: "CLIPTextEncode", widgets_values: ["a"] },
            ],
            links: [
              [10, 1, 0, 2, 0, "X"],
              [11, 2, 0, 1, 0, "Y"],
            ],
          },
        ],
        extra_field: { kept: true },
      },
    } as unknown as WorkflowJSON;

    const doc = mint(wf, catalog);
    const out = project(doc, catalog) as Record<string, unknown>;
    const defs = out["definitions"] as Record<string, unknown>;
    expect(defs["extra_field"]).toEqual({ kept: true });
    const sgs = defs["subgraphs"] as Array<Record<string, unknown>>;
    expect(sgs).toHaveLength(1);
    const sg = sgs[0]!;
    // interior nodes preserved in MINT order (2 then 1), not id-sorted
    expect((sg["nodes"] as Array<{ id: number }>).map((n) => n.id)).toEqual([2, 1]);
    expect((sg["links"] as unknown[][]).map((l) => l[0])).toEqual([10, 11]);
  });
});

describe("project — widgetsToPositional catalog-mismatch throws (schema §1.2)", () => {
  const catalogA = CAT({ CLIPTextEncode: { widget_order: ["text"] } });
  const mkDoc = () => {
    const wf = {
      nodes: [{ id: 1, type: "CLIPTextEncode", widgets_values: ["hello"] }],
      links: [],
    } as unknown as WorkflowJSON;
    return mint(wf, catalogA);
  };

  it("throws when a node has named widgets but its type is absent from the catalog", () => {
    const doc = mkDoc();
    expect(() => project(doc, CAT({}))).toThrow(/is not in the pinned catalog/);
  });

  it("throws when a stored widget name is not in the catalog's widget_order", () => {
    const doc = mkDoc();
    const wrong = CAT({ CLIPTextEncode: { widget_order: ["some_other_widget"] } });
    expect(() => project(doc, wrong)).toThrow(/is not in widget_order/);
  });
});

describe("project — string node ids sort lexicographically (idCompare non-numeric arm)", () => {
  it("orders nodes with string ids by string comparison", () => {
    const doc = new Y.Doc();
    initDoc(doc, "cat@test");
    const nodes = nodesMap(doc);
    nodes.set("b", createNodeMap({ id: "b", type: "Note" } as never));
    nodes.set("a", createNodeMap({ id: "a", type: "Note" } as never));
    nodes.set("c", createNodeMap({ id: "c", type: "Note" } as never));
    const out = project(doc, CAT({})) as Record<string, unknown>;
    expect((out["nodes"] as Array<{ id: string }>).map((n) => n.id)).toEqual(["a", "b", "c"]);
  });
});
