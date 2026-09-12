/**
 * `insert_workflow` — merge a template workflow (nodes, links,
 * `definitions.subgraphs`) into an existing doc in ONE transaction.
 *
 * TDD V1.5 (in-app-agent program, ADR-T8): today a template with subgraphs can
 * only reach a live doc through a whole-doc reseed, because every other op
 * schema rejects definition-bearing fields (KA-11). This op carries the
 * template as an opaque payload the applier merges under the same guards the
 * six existing kinds obey: collision-free ids (validated BEFORE any mutation,
 * KA-4), definition dedupe/fork by content hash, exact-replay no-op through
 * the op_id gate, and byte-identical doc on rejection.
 *
 * ID allocation belongs to the applier and is derived from the immutable op
 * id plus each raw id, never from mutable document state.
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import { appliedMap } from "../src/doc.js";
import {
  OPAQUE_WIDGETS_KEY,
  applyOps,
  mint,
  project,
  remapWorkflowIds,
  type Op,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";
import { remapInsertedWorkflowIds } from "../src/remap.js";
import { appliedOpIds, noOpIds, rejectedOutcomeWithIndex } from "./apply-result-helpers.js";

const catalog: WidgetCatalog = {
  types: {
    Src: { widget_order: [] },
    Sink: { widget_order: ["inputcount"] },
    KSampler: { widget_order: ["seed", "steps"] },
    Inner: { widget_order: ["text"] },
  },
};

function baseWorkflow(): WorkflowJSON {
  return {
    last_node_id: 7,
    last_link_id: 7,
    nodes: [
      { id: 1, type: "Src" },
      { id: 2, type: "Src" },
      { id: 3, type: "Sink", inputs: [{ name: "in", link: 7 }], widgets_values: [1] },
      { id: 4, type: "KSampler", widgets_values: [1, 2] },
      { id: 6, type: "def-1" },
    ],
    links: [[7, 2, 0, 3, 0, "X"]],
    definitions: {
      subgraphs: [{ id: "def-1", name: "D", nodes: [{ id: 27, type: "Inner", widgets_values: ["t"] }], links: [] }],
    },
  } as unknown as WorkflowJSON;
}

/** A template with its OWN definition `def-2` and ids already disjoint from the base. */
function template(): WorkflowJSON {
  return {
    nodes: [
      { id: 100, type: "Src", pos: [0, 0] },
      { id: 101, type: "def-2", inputs: [{ name: "a", link: 200 }] },
    ],
    links: [[200, 100, 0, 101, 0, "X"]],
    definitions: {
      subgraphs: [{ id: "def-2", name: "E", nodes: [{ id: 5, type: "Inner", widgets_values: ["u"] }], links: [] }],
    },
  } as unknown as WorkflowJSON;
}

let seq = 0;
function env(): Pick<Op, "op_id" | "actor" | "base_version" | "stamp"> {
  return {
    op_id: ("i" + String(seq++).padStart(4, "0")).padEnd(32, "0"),
    actor: "a",
    base_version: 1,
    stamp: [1, "a"] as [number, string],
  };
}

function insertOp(workflow: unknown, overrides: Partial<Op> = {}): Op {
  return { ...env(), op: "insert_workflow", workflow, ...overrides } as unknown as Op;
}

const bytes = (doc: Y.Doc): Buffer => Buffer.from(Y.encodeStateAsUpdate(doc));

function ids(wf: WorkflowJSON): unknown[] {
  return (wf.nodes ?? []).map((n) => n.id);
}
function linkIds(wf: WorkflowJSON): unknown[] {
  return (wf.links ?? []).map((l) => (l as unknown[])[0]);
}
function defIds(wf: WorkflowJSON): string[] {
  const defs = (wf as { definitions?: { subgraphs?: { id: unknown }[] } }).definitions;
  return (defs?.subgraphs ?? []).map((s) => String(s.id));
}

describe("insert_workflow: happy path", () => {
  it("resolves string link endpoints to normalized numeric node ids", () => {
    const doc = mint(baseWorkflow(), catalog);
    const op = insertOp({
      nodes: [{ id: 1, type: "Src", title: "alias source" }, { id: 2, type: "Sink", title: "alias sink" }],
      links: [[3, "1", 0, "2", 0, "alias"]],
    });

    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const workflow = project(doc, catalog);
    const source = workflow.nodes!.find((node) => node.title === "alias source")!;
    const sink = workflow.nodes!.find((node) => node.title === "alias sink")!;
    const link = workflow.links!.find((candidate) => (candidate as unknown[])[5] === "alias") as unknown[];
    expect(link).toBeDefined();
    expect(link[1]).toBe(source.id);
    expect(link[3]).toBe(sink.id);
  });

  it("scopes repeated nested definition ids to their sibling definition paths", () => {
    const doc = mint(baseWorkflow(), catalog);
    const nested = (name: string) => ({ id: "shared", name, nodes: [], links: [] });
    const op = insertOp({
      nodes: [],
      links: [],
      definitions: {
        subgraphs: [
          {
            id: "left",
            name: "Left",
            nodes: [{ id: 1, type: "shared" }],
            links: [],
            definitions: { subgraphs: [nested("Left shared")] },
          },
          {
            id: "right",
            name: "Right",
            nodes: [{ id: 1, type: "shared" }],
            links: [],
            definitions: { subgraphs: [nested("Right shared")] },
          },
        ],
      },
    });

    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const definitions = project(doc, catalog).definitions!.subgraphs! as Array<Record<string, unknown>>;
    const left = definitions.find((definition) => definition["name"] === "Left")!;
    const right = definitions.find((definition) => definition["name"] === "Right")!;
    const nestedId = (definition: Record<string, unknown>): string =>
      String(((definition["definitions"] as { subgraphs: Array<{ id: unknown }> }).subgraphs[0]!).id);
    const hostType = (definition: Record<string, unknown>): string =>
      String(((definition["nodes"] as Array<{ type: unknown }>)[0]!).type);

    expect(nestedId(left)).not.toBe(nestedId(right));
    expect(hostType(left)).toBe(nestedId(left));
    expect(hostType(right)).toBe(nestedId(right));
  });

  it("drops a depth-2 object link with a missing endpoint and keeps its valid sibling", () => {
    const nested = {
      id: "nested",
      nodes: [{ id: 1, type: "Src" }, { id: 2, type: "Sink" }],
      links: [
        { id: 10, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0, type: "valid" },
        { id: 11, origin_id: 1, origin_slot: 0, target_id: 999, target_slot: 0, type: "dangling" },
      ],
    };
    const outer = { id: "outer", nodes: [], links: [], definitions: { subgraphs: [nested] } };

    const remapped = remapInsertedWorkflowIds(
      { nodes: [], definitions: { subgraphs: [outer] } } as unknown as WorkflowJSON,
      "object-link-op".padEnd(32, "0"),
    ) as unknown as { definitions: { subgraphs: Array<{ definitions: { subgraphs: Array<{ links: Array<{ type: string }> }> } }> } };
    const links = remapped.definitions.subgraphs[0]!.definitions.subgraphs[0]!.links;

    expect(links).toHaveLength(1);
    expect(links[0]!.type).toBe("valid");
  });

  it("drops a depth-3 array link with a missing endpoint", () => {
    const deepest = {
      id: "deepest",
      nodes: [{ id: 1, type: "Src" }],
      links: [[10, 1, 0, 999, 0, "dangling"]],
    };
    const middle = { id: "middle", nodes: [], links: [], definitions: { subgraphs: [deepest] } };
    const outer = { id: "outer", nodes: [], links: [], definitions: { subgraphs: [middle] } };

    const remapped = remapInsertedWorkflowIds(
      { nodes: [], definitions: { subgraphs: [outer] } } as unknown as WorkflowJSON,
      "array-link-op".padEnd(32, "0"),
    ) as unknown as { definitions: { subgraphs: Array<{ definitions: { subgraphs: Array<{ definitions: { subgraphs: Array<{ links: unknown[] }> } }> } }> } };

    expect(remapped.definitions.subgraphs[0]!.definitions.subgraphs[0]!.definitions.subgraphs[0]!.links).toEqual([]);
  });

  it("keeps valid links at every nested definition depth", () => {
    const deepest = {
      id: "deepest",
      nodes: [{ id: 1, type: "Src" }, { id: 2, type: "Sink" }],
      links: [[10, 1, 0, 2, 0, "valid"]],
    };
    const outer = { id: "outer", nodes: [], links: [], definitions: { subgraphs: [deepest] } };

    const remapped = remapInsertedWorkflowIds(
      { nodes: [], definitions: { subgraphs: [outer] } } as unknown as WorkflowJSON,
      "valid-link-op".padEnd(32, "0"),
    ) as unknown as { definitions: { subgraphs: Array<{ definitions: { subgraphs: Array<{ links: unknown[][] }> } }> } };
    const links = remapped.definitions.subgraphs[0]!.definitions.subgraphs[0]!.links;

    expect(links).toHaveLength(1);
    expect(links[0]![5]).toBe("valid");
    expect(links[0]![1]).toEqual(expect.stringContaining("valid-link-op"));
    expect(links[0]![3]).toEqual(expect.stringContaining("valid-link-op"));
  });

  it("merges template nodes, links and definitions into the doc in one op", () => {
    const doc = mint(baseWorkflow(), catalog);
    const op = insertOp(template());
    const result = applyOps(doc, [op], catalog);

    expect(appliedOpIds(result)).toEqual([op.op_id]);
    const wf = project(doc, catalog);
    expect(ids(wf).slice(0, 5)).toEqual([1, 2, 3, 4, 6]);
    expect(ids(wf).slice(5).every((id) => typeof id === "string" && id.includes(op.op_id))).toBe(true);
    expect(linkIds(wf)[1]).toEqual(expect.stringContaining(op.op_id));
    expect(defIds(wf).find((id) => id !== "def-1")).toMatch(/^[0-9a-f-]{36}$/);
    // Inserted nodes project with their widgets resolved through the catalog.
    const n100 = wf.nodes!.find((n) => n.pos?.[0] === 0)!;
    expect(n100.type).toBe("Src");
    expect(n100.pos).toEqual([0, 0]);
    const n101 = wf.nodes!.find((n) => n.type === defIds(wf)[1])!;
    expect((n101.inputs?.[0] as { link?: unknown } | undefined)?.link).toBe(linkIds(wf)[1]);
    expect(wf.last_node_id).toBe(7);
    expect(wf.last_link_id).toBe(7);
  });

  it("is an exact-replay no-op through the op_id gate (no second copy)", () => {
    const doc = mint(baseWorkflow(), catalog);
    const op = insertOp(template());
    applyOps(doc, [op], catalog);
    const before = bytes(doc);
    const again = applyOps(doc, [op], catalog);
    expect(noOpIds(again)).toEqual([op.op_id]);
    expect(bytes(doc).equals(before)).toBe(true);
    expect(ids(project(doc, catalog))).toHaveLength(7);
  });

  it("remaps a template definition even when its raw id matches live content", () => {
    const doc = mint(baseWorkflow(), catalog);
    const tpl = template();
    (tpl as { definitions: { subgraphs: unknown[] } }).definitions.subgraphs = [
      { id: "def-1", name: "D", nodes: [{ id: 27, type: "Inner", widgets_values: ["t"] }], links: [] },
    ];
    tpl.nodes![1] = { id: 101, type: "def-1", inputs: [{ name: "a", link: 200 }] };
    const op = insertOp(tpl);
    const result = applyOps(doc, [op], catalog);
    expect(appliedOpIds(result)).toEqual([op.op_id]);
    const wf = project(doc, catalog);
    expect(defIds(wf)).toHaveLength(2);
    const insertedDefinitionId = defIds(wf).find((id) => id !== "def-1")!;
    expect(insertedDefinitionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(wf.nodes!.find((n) => n.id !== 6 && n.type === insertedDefinitionId)).toBeDefined();
  });

  it("preserves opaque widgets_values for uncatalogued inserted nodes", () => {
    const doc = mint(baseWorkflow(), catalog);
    const tpl = { nodes: [{ id: 300, type: "Note", widgets_values: ["hello"] }], links: [] } as unknown as WorkflowJSON;
    applyOps(doc, [insertOp(tpl)], catalog);
    const wf = project(doc, catalog);
    expect(wf.nodes!.find((n) => n.type === "Note")!.widgets_values).toEqual(["hello"]);
    expect(OPAQUE_WIDGETS_KEY).toBeTruthy();
  });

  it("accepts nodes without optional links, groups, or definitions", () => {
    const doc = mint(baseWorkflow(), catalog);
    const op = insertOp({ nodes: [{ id: 1, type: "Src", title: "minimal" }] });

    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    expect(project(doc, catalog).nodes!.find((node) => node.title === "minimal")?.id).toEqual(expect.stringContaining(op.op_id));
  });

  it("merges groups deterministically without dropping existing groups", () => {
    const seeded = { ...baseWorkflow(), groups: [{ title: "Base" }] } as WorkflowJSON;
    const doc = mint(seeded, catalog);
    applyOps(doc, [insertOp({ nodes: [], links: [], groups: [{ title: "Inserted" }] })], catalog);

    expect(project(doc, catalog).groups).toEqual([{ title: "Base" }, { title: "Inserted" }]);
  });

  it("scrubs private __ keys recursively from every inserted payload branch", () => {
    const doc = mint(baseWorkflow(), catalog);
    applyOps(doc, [insertOp({
      nodes: [{ id: 100, type: "Src", properties: { visible: true, __definition_digest: "node-secret" } }],
      links: [],
      groups: [{ title: "G", nested: { __private: "group-secret", visible: true } }],
      definitions: {
        subgraphs: [{ id: "def-2", nodes: [], links: [], metadata: { __definition_digest: "def-secret", visible: true } }],
      },
    })], catalog);

    const json = JSON.stringify(project(doc, catalog));
    expect(json).not.toContain("__definition_digest");
    expect(json).not.toContain("__private");
    expect(json).toContain('"visible":true');
  });

  it("makes colliding concurrent inserts converge in either legal arrival order", () => {
    const seed = Y.encodeStateAsUpdate(mint(baseWorkflow(), catalog));
    const run = (ops: Op[]): WorkflowJSON => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, seed);
      for (const op of ops) applyOps(doc, [op], catalog);
      return project(doc, catalog);
    };
    const lower = insertOp(
      { nodes: [{ id: 100, type: "Src", title: "lower" }, { id: 101, type: "Sink" }], links: [[200, 100, 0, 101, 0, "lower"]] },
      { op_id: "a".repeat(32), stamp: [2, "a"] },
    );
    const higher = insertOp(
      { nodes: [{ id: 100, type: "Src", title: "higher" }, { id: 101, type: "Sink" }], links: [[200, 100, 0, 101, 0, "higher"]] },
      { op_id: "b".repeat(32), stamp: [3, "b"] },
    );

    expect(run([lower, higher])).toEqual(run([higher, lower]));
    expect(run([lower, higher]).nodes!.filter((node) => node.title === "lower" || node.title === "higher")).toHaveLength(2);
    expect(run([lower, higher]).links!.filter((link) => ["lower", "higher"].includes((link as unknown[])[5] as string))).toHaveLength(2);
  });

  it("keeps valid inserted content when a carried link endpoint was concurrently deleted", () => {
    const seed = Y.encodeStateAsUpdate(mint(baseWorkflow(), catalog));
    const insert = insertOp({
      nodes: [{ id: 100, type: "Src", title: "inserted source" }, { id: 101, type: "Sink", title: "inserted sink" }],
      links: [[200, 100, 0, 101, 0, "valid"], [201, 100, 0, 1, 0, "missing endpoint"]],
      groups: [{ title: "Inserted group" }],
      definitions: { subgraphs: [{ id: "inserted-def", nodes: [], links: [] }] },
    });
    const remove = {
      ...env(), op: "delete_node", node_id: 1, removed_links: [], stamp: [2, "b"],
    } as unknown as Op;
    const run = (ops: Op[]): WorkflowJSON => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, seed);
      for (const op of ops) applyOps(doc, [op], catalog);
      return project(doc, catalog);
    };

    const deleteThenInsert = run([remove, insert]);
    const insertThenDelete = run([insert, remove]);
    expect(deleteThenInsert).toEqual(insertThenDelete);
    expect(deleteThenInsert.nodes!.filter((node) => typeof node.title === "string" && node.title.startsWith("inserted"))).toHaveLength(2);
    expect(deleteThenInsert.links!.filter((link) => (link as unknown[])[5] === "valid")).toHaveLength(1);
    expect(deleteThenInsert.links!.some((link) => (link as unknown[])[5] === "missing endpoint")).toBe(false);
    expect(deleteThenInsert.groups).toContainEqual({ title: "Inserted group" });
    expect(defIds(deleteThenInsert).some((id) => id !== "def-1" && /^[0-9a-f-]{36}$/.test(id))).toBe(true);
  });

  it("rejects a remapped definition id already present anywhere in the stored tree", () => {
    const op = insertOp(template());
    const remapped = remapInsertedWorkflowIds(template(), op.op_id);
    const remappedId = defIds(remapped)[0]!;
    const base = baseWorkflow();
    base.definitions!.subgraphs!.push({ id: remappedId, nodes: [], links: [] });
    const doc = mint(base, catalog);
    const before = bytes(doc);

    const result = applyOps(doc, [op], catalog);

    expect(rejectedOutcomeWithIndex(result)).toMatchObject({
      index: 0,
      code: "definition_conflict",
    });
    expect(bytes(doc).equals(before)).toBe(true);
  });

  it("stores nested definitions as addressable maps for later interior set_widget", () => {
    const doc = mint(baseWorkflow(), catalog);
    const nested = { id: "nested-def", nodes: [{ id: 9, type: "Inner", widgets_values: ["before"] }], links: [] };
    const outer = {
      id: "outer-def", name: "Outer", nodes: [{ id: 8, type: "nested-def" }], links: [], definitions: { subgraphs: [nested] },
    };
    applyOps(doc, [insertOp({ nodes: [{ id: 100, type: "outer-def" }], links: [], definitions: { subgraphs: [outer] } })], catalog);
    const projected = project(doc, catalog) as { nodes: Array<{ id: string; type: string }>; definitions: { subgraphs: Array<Record<string, unknown>> } };
    const projectedOuter = projected.definitions.subgraphs.find((definition) => definition["name"] === "Outer") ?? projected.definitions.subgraphs.find((definition) => definition["id"] !== "def-1")!;
    const projectedNested = (projectedOuter["definitions"] as { subgraphs: Array<Record<string, unknown>> }).subgraphs[0]!;
    const outerNode = (projectedOuter["nodes"] as Array<{ id: string }>)[0]!;
    const innerNode = (projectedNested["nodes"] as Array<{ id: string }>)[0]!;
    const host = projected.nodes.find((node) => node.type === projectedOuter["id"])!;
    const edit = { ...env(), op: "set_widget", node_id: host.id, path: [host.id, outerNode.id, innerNode.id], inner_widget: "text", value: "after" } as unknown as Op;

    expect(applyOps(doc, [edit], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const defs = (project(doc, catalog) as { definitions: { subgraphs: Array<Record<string, unknown>> } }).definitions.subgraphs;
    const updatedOuter = defs.find((definition) => definition.id === projectedOuter["id"]) as {
      definitions: { subgraphs: Array<{ nodes: Array<{ widgets_values: unknown[] }> }> };
    };
    expect(updatedOuter.definitions.subgraphs[0]!.nodes[0]!.widgets_values).toEqual(["after"]);
  });
});

describe("insert_workflow: rejection (KA-4 byte identity, op_id absent from applied)", () => {
  const cases: { name: string; workflow: unknown; code: string; withCatalog: boolean }[] = [
    {
      name: "exact duplicate raw node ids",
      workflow: { nodes: [{ id: 100, type: "Src" }, { id: 100, type: "Src" }], links: [] },
      code: "malformed_op",
      withCatalog: true,
    },
    {
      name: "normalized duplicate raw node ids",
      workflow: { nodes: [{ id: 1, type: "Src" }, { id: "1", type: "Src" }], links: [] },
      code: "malformed_op",
      withCatalog: true,
    },
    {
      name: "missing raw node id",
      workflow: { nodes: [{ type: "Src" }], links: [] },
      code: "malformed_op",
      withCatalog: true,
    },
    {
      name: "exact duplicate raw link ids",
      workflow: { nodes: [], links: [[7, 1, 0, 2, 0, "X"], [7, 1, 0, 2, 0, "X"]] },
      code: "malformed_op",
      withCatalog: true,
    },
    {
      name: "normalized duplicate raw link ids",
      workflow: { nodes: [], links: [[1, 1, 0, 2, 0, "X"], ["1", 1, 0, 2, 0, "X"]] },
      code: "malformed_op",
      withCatalog: true,
    },
    {
      name: "missing raw link id",
      workflow: { nodes: [], links: [[undefined, 1, 0, 2, 0, "X"]] },
      code: "malformed_op",
      withCatalog: true,
    },
    {
      name: "definition normalized duplicate raw node ids",
      workflow: {
        nodes: [],
        links: [],
        definitions: { subgraphs: [{ id: "outer", nodes: [{ id: 1 }, { id: "1" }], links: [] }] },
      },
      code: "malformed_op",
      withCatalog: true,
    },
    {
      name: "definition missing raw node id",
      workflow: {
        nodes: [],
        links: [],
        definitions: { subgraphs: [{ id: "outer", nodes: [{ type: "Inner" }], links: [] }] },
      },
      code: "malformed_op",
      withCatalog: true,
    },
    {
      name: "definition normalized duplicate raw link ids",
      workflow: {
        nodes: [],
        links: [],
        definitions: {
          subgraphs: [
            {
              id: "outer",
              nodes: [{ id: 10, type: "Inner" }, { id: 11, type: "Inner" }],
              links: [[1, 10, 0, 11, 0, "X"], ["1", 10, 0, 11, 0, "X"]],
            },
          ],
        },
      },
      code: "malformed_op",
      withCatalog: true,
    },
    {
      name: "definition missing raw link id",
      workflow: {
        nodes: [],
        links: [],
        definitions: {
          subgraphs: [
            {
              id: "outer",
              nodes: [{ id: 10, type: "Inner" }, { id: 11, type: "Inner" }],
              links: [[undefined, 10, 0, 11, 0, "X"]],
            },
          ],
        },
      },
      code: "malformed_op",
      withCatalog: true,
    },
    {
      name: "nested definition normalized duplicate raw node ids",
      workflow: {
        nodes: [],
        links: [],
        definitions: {
          subgraphs: [
            {
              id: "outer",
              nodes: [],
              links: [],
              definitions: { subgraphs: [{ id: "inner", nodes: [{ id: 1 }, { id: "1" }], links: [] }] },
            },
          ],
        },
      },
      code: "malformed_op",
      withCatalog: true,
    },
    { name: "missing workflow", workflow: undefined, code: "malformed_op", withCatalog: true },
    { name: "non-object workflow", workflow: "nope", code: "malformed_op", withCatalog: true },
    { name: "nodes is not an array", workflow: { nodes: {}, links: [] }, code: "malformed_op", withCatalog: true },
    {
      name: "node without type",
      workflow: { nodes: [{ id: 100, pos: [0, 0] }], links: [] },
      code: "invalid_node_payload",
      withCatalog: true,
    },
    {
      name: "positional widgets with no catalog",
      workflow: { nodes: [{ id: 100, type: "KSampler", widgets_values: [1, 2] }], links: [] },
      code: "catalog_required",
      withCatalog: false,
    },
  ];

  for (const c of cases) {
    it(`rejects: ${c.name} → ${c.code}`, () => {
      const doc = mint(baseWorkflow(), catalog);
      const before = bytes(doc);
      const projectedBefore = project(doc, catalog);
      const op = insertOp(c.workflow);
      const result = applyOps(doc, [op], c.withCatalog ? catalog : undefined);
      expect(rejectedOutcomeWithIndex(result)!.code).toBe(c.code);
      expect(bytes(doc).equals(before)).toBe(true);
      expect(project(doc, catalog)).toEqual(projectedBefore);
      expect(appliedMap(doc).has(op.op_id)).toBe(false);
      expect(applyOps(doc, [op], c.withCatalog ? catalog : undefined)).toEqual(result);
      expect(bytes(doc).equals(before)).toBe(true);
    });
  }

  it("remaps raw ids that collide with live ids without touching incumbents", () => {
    const doc = mint(baseWorkflow(), catalog);
    const before = bytes(doc);
    const wf = { nodes: [{ id: 100, type: "Src" }, { id: 101, type: "Src" }, { id: 4, type: "Src" }], links: [] };
    expect(applyOps(doc, [insertOp(wf)], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    expect(bytes(doc).equals(before)).toBe(false);
    expect(project(doc, catalog).nodes!.find((node) => node.id === 4)?.type).toBe("KSampler");
    expect(ids(project(doc, catalog))).toHaveLength(8);
  });

  it("routes dangling link endpoints through the existing unknown-node no-op path", () => {
    const doc = mint(baseWorkflow(), catalog);
    const op = insertOp({ nodes: [], links: [[200, 100, 0, 999, 0, "X"]] });
    const result = applyOps(doc, [op], catalog);

    expect(result.outcomes[0]).toMatchObject({ outcome: "no-op" });
    expect(appliedMap(doc).has(op.op_id)).toBe(true);
  });

  it("rejects an id-less nested subgraph atomically", () => {
    const doc = mint(baseWorkflow(), catalog);
    const before = bytes(doc);
    const op = insertOp({
      nodes: [{ id: 100, type: "Src" }],
      links: [],
      definitions: {
        subgraphs: [{ id: "outer", nodes: [], links: [], definitions: { subgraphs: [{ nodes: [], links: [] }] } }],
      },
    });

    expect(rejectedOutcomeWithIndex(applyOps(doc, [op], catalog))!.code).toBe("malformed_op");
    expect(bytes(doc).equals(before)).toBe(true);
    expect(appliedMap(doc).has(op.op_id)).toBe(false);
  });

  it("remaps a nested definition id already used in the live tree", () => {
    const doc = mint(baseWorkflow(), catalog);
    const op = insertOp({
      nodes: [{ id: 100, type: "outer" }], links: [],
      definitions: {
        subgraphs: [{ id: "outer", nodes: [], links: [], definitions: { subgraphs: [{ id: "def-1", nodes: [], links: [] }] } }],
      },
    });

    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
  });

  it("inserts same-raw-id definitions identically in either arrival order", () => {
    const seed = Y.encodeStateAsUpdate(mint(baseWorkflow(), catalog));
    const makeDoc = (): Y.Doc => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, seed);
      return doc;
    };
    const makeConflict = (name: string, nodeId: number, opId: string): Op =>
      insertOp(
        {
          nodes: [{ id: nodeId, type: "def-1" }],
          links: [],
          definitions: { subgraphs: [{ id: "def-1", name, nodes: [], links: [] }] },
        },
        { op_id: opId },
      );
    const first = makeConflict("A", 100, "a".repeat(32));
    const second = makeConflict("B", 101, "b".repeat(32));
    const docA = makeDoc();
    const docB = makeDoc();

    expect(applyOps(docA, [first], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    expect(applyOps(docA, [second], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    expect(applyOps(docB, [second], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    expect(applyOps(docB, [first], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    expect(project(docA, catalog)).toEqual(project(docB, catalog));
    expect(defIds(project(docA, catalog))).toHaveLength(3);
  });

  it("never overwrites an occupied legacy fork-shaped id", () => {
    const wf = baseWorkflow() as WorkflowJSON & { definitions: { subgraphs: Record<string, unknown>[] } };
    wf.definitions.subgraphs.push({ id: "def-1-deadbeef", name: "Occupied", nodes: [], links: [] });
    const doc = mint(wf, catalog);
    const before = bytes(doc);
    const op = insertOp({
      nodes: [{ id: 100, type: "def-1" }],
      links: [],
      definitions: { subgraphs: [{ id: "def-1", name: "Different", nodes: [], links: [] }] },
    });

    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    expect(bytes(doc).equals(before)).toBe(false);
    const definitions = (project(doc, catalog) as { definitions: { subgraphs: { id: string; name: string }[] } }).definitions.subgraphs;
    expect(definitions.find((definition) => definition.id === "def-1-deadbeef")!.name).toBe("Occupied");
  });
});

describe("remapWorkflowIds (minter-side helper)", () => {
  it("shifts node and link ids and rewrites every reference, leaving definitions untouched", () => {
    const out = remapWorkflowIds(template(), { nodeIdStart: 8, linkIdStart: 8 });
    expect(ids(out)).toEqual([8, 9]);
    expect(linkIds(out)).toEqual([8]);
    const link = out.links![0] as unknown[];
    expect(link.slice(0, 5)).toEqual([8, 8, 0, 9, 0]);
    expect(out.nodes![1]!.inputs).toEqual([{ name: "a", link: 8 }]);
    expect(defIds(out)).toEqual(["def-2"]);
    // Interior definition ids are a separate namespace: unchanged.
    const inner = (out as { definitions: { subgraphs: { nodes: { id: unknown }[] }[] } }).definitions.subgraphs[0]!;
    expect(inner.nodes[0]!.id).toBe(5);
  });

  it("rewrites output links arrays and does not mutate its input", () => {
    const tpl = {
      nodes: [
        { id: 1, type: "Src", outputs: [{ name: "o", links: [1, 2] }] },
        { id: 2, type: "Sink", inputs: [{ name: "in", link: 1 }] },
        { id: 3, type: "Sink", inputs: [{ name: "in", link: 2 }] },
      ],
      links: [
        [1, 1, 0, 2, 0, "X"],
        [2, 1, 0, 3, 0, "X"],
      ],
    } as unknown as WorkflowJSON;
    const snapshot = structuredClone(tpl);
    const out = remapWorkflowIds(tpl, { nodeIdStart: 10, linkIdStart: 20 });
    expect(tpl).toEqual(snapshot);
    expect(ids(out)).toEqual([10, 11, 12]);
    expect(out.nodes![0]!.outputs).toEqual([{ name: "o", links: [20, 21] }]);
    expect(out.nodes![2]!.inputs).toEqual([{ name: "in", link: 21 }]);
    expect(out.links).toEqual([
      [20, 10, 0, 11, 0, "X"],
      [21, 10, 0, 12, 0, "X"],
    ]);
  });
});
