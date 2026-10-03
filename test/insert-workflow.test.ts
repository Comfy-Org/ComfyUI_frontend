/**
 * `insert_workflow` — merge a template workflow (nodes, links,
 * `definitions.subgraphs`) into an existing doc in ONE transaction.
 *
 * TDD V1.5 (in-app-agent program, ADR-T8): today a template with subgraphs can
 * only reach a live doc through a whole-doc reseed, because every other op
 * schema rejects definition-bearing fields (KA-11). This op carries the
 * template as an opaque payload the applier merges under the same guards the
 * seven existing kinds obey: collision-free ids (validated BEFORE any mutation,
 * KA-4), definition dedupe/fork by content hash, exact-replay no-op through
 * the op_id gate, and byte-identical doc on rejection.
 *
 * ID allocation belongs to the applier and is derived from the immutable op
 * id plus each raw id alone, never from mutable document state — including
 * for links. An earlier revision of this PR made a link's numeric id
 * (ComfyUI_frontend#18458 — `LinkId` is a branded `number`, unlike the
 * string-or-number `NodeId`) an exception to that rule, retrying against the
 * target document's already-persisted numeric link ids to avoid a collision.
 * Review (Christian Byrne, PR #245) found that retry made link identity
 * depend on local arrival order, so `remap.ts`'s `derivedLinkId` mints
 * PURELY from the op's own content instead (ADR-033, amended), spending the
 * full safe-integer range (53 bits) so a genuine collision is an accepted,
 * quantified residual risk (`docs/decisions/EXCEPTIONS.md`'s KA-5 row)
 * rather than something the mint tries to avoid by reading state.
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import { appliedMap } from "../src/doc.js";
import {
  OPAQUE_WIDGETS_KEY,
  applyOps,
  mint,
  project,
  type Op,
  type AddNodeOp,
  type DefineSubgraphOp,
  type DeleteNodeOp,
  type DisconnectOp,
  type SubgraphDefinition,
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

function replaySnapshot(seed: Uint8Array, ops: Op[]): WorkflowJSON {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, seed);
  for (const op of ops) applyOps(doc, [op], catalog);
  return project(doc, catalog);
}

/**
 * One link's numeric id, as `remap.ts`'s `derivedLinkId` mint would produce
 * it for (`opId`, `"root"`, `rawLinkId`) — a pure function of those two
 * inputs alone (ADR-033, amended), so this is exactly what a real apply of
 * the same (opId, rawLinkId) will also compute, regardless of document
 * state or arrival order.
 */
function derivedLinkIdForTest(opId: string, rawLinkId: number): number {
  const remapped = remapInsertedWorkflowIds(
    { nodes: [{ id: "a", type: "Src" }, { id: "b", type: "Sink" }], links: [[rawLinkId, "a", 0, "b", 0, "x"]] } as unknown as WorkflowJSON,
    opId,
  ) as unknown as { links: Array<[number, ...unknown[]]> };
  return remapped.links[0]![0];
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
  it("maps one explicit raw group id differently for two fixed operation ids", () => {
    // Independently derived with Node, without importing the production remapper:
    // the string seed `insert:<op>:root:group:<original>`, first 128 bits of its
    // sha256, modulo 2^53 - 1, plus one (group ids are numeric, as the frontend
    // schema requires):
    // node -e 'const c=require("crypto");for(const op of ["c641df0c31f9440b9385ac8e01e099b2","0123456789abcdef0123456789abcdef"]){const h=c.createHash("sha256").update(`insert:${op}:root:group:${encodeURIComponent(JSON.stringify("raw-group"))}`).digest("hex").slice(0,32);console.log(String(BigInt("0x"+h)%BigInt(Number.MAX_SAFE_INTEGER)+1n))}'
    const vectors = [
      ["c641df0c31f9440b9385ac8e01e099b2", 5516296349936697],
      ["0123456789abcdef0123456789abcdef", 8384614748614864],
    ] as const;

    for (const [opId, expectedGroupId] of vectors) {
      const doc = mint({ nodes: [], links: [] }, catalog);
      const op = insertOp(
        { nodes: [], links: [], groups: [{ id: "raw-group", title: "Pinned group" }] },
        { op_id: opId },
      );
      seq--;

      expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
      expect(project(doc, catalog).groups).toEqual([{ id: expectedGroupId, title: "Pinned group" }]);
    }
  });

  it("maps the frozen CLI asymmetric raw-ID fixture to exact operation-derived IDs", () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    const op = {
      op: "insert_workflow",
      op_id: "c641df0c31f9440b9385ac8e01e099b2",
      actor: "consumer-pass30",
      base_version: 48,
      stamp: [48, "consumer-pass30"],
      workflow: {
        nodes: [{ id: 701, type: "def-asym" }],
        definitions: {
          subgraphs: [{ id: "def-asym", links: [], nodes: [{ id: "inner-Z9", type: "Inner" }] }],
        },
      },
    } as Op;

    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const workflow = project(doc, catalog);
    const definition = workflow.definitions!.subgraphs![0] as {
      id: string;
      nodes: Array<{ id: string }>;
    };
    expect(workflow.nodes![0]!.id).toBe("insert:c641df0c31f9440b9385ac8e01e099b2:root:node:701");
    expect(workflow.nodes![0]!.type).toBe("c7d70ff1-6dca-4b80-83ee-351b8510f528");
    expect(definition.id).toBe("c7d70ff1-6dca-4b80-83ee-351b8510f528");
    expect(definition.nodes[0]!.id).toBe(
      "insert:c641df0c31f9440b9385ac8e01e099b2:root/definition:%22def-asym%22:node:%22inner-Z9%22",
    );
  });

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

  it("scrubs a dropped depth-2 link from node slot references", () => {
    const nested = {
      id: "nested",
      nodes: [
        { id: 1, type: "Src", outputs: [{ name: "out", links: [11, 10] }] },
        { id: 2, type: "Sink", inputs: [{ name: "in", link: 11 }] },
      ],
      links: [
        [10, 1, 0, 2, 0, "valid"],
        [11, 999, 0, 2, 0, "dangling"],
      ],
    };
    const outer = { id: "outer", nodes: [], links: [], definitions: { subgraphs: [nested] } };

    const remapped = remapInsertedWorkflowIds(
      { nodes: [], definitions: { subgraphs: [outer] } } as unknown as WorkflowJSON,
      "nested-slot-op".padEnd(32, "0"),
    ) as unknown as {
      definitions: {
        subgraphs: Array<{
          definitions: { subgraphs: Array<{ nodes: Array<{ inputs?: Array<{ link: unknown }>; outputs?: Array<{ links: unknown[] }> }>; links: unknown[][] }> };
        }>;
      };
    };
    const graph = remapped.definitions.subgraphs[0]!.definitions.subgraphs[0]!;

    expect(graph.nodes[0]!.outputs![0]!.links).toEqual([graph.links[0]![0]]);
    expect(graph.nodes[1]!.inputs![0]!.link).toBeNull();
  });

  it("scrubs a dropped top-level link from node slot references", () => {
    const remapped = remapInsertedWorkflowIds(
      {
        nodes: [
          { id: 1, type: "Src", outputs: [{ name: "out", links: [11, 10] }] },
          { id: 2, type: "Sink", inputs: [{ name: "in", link: 11 }] },
        ],
        links: [
          [10, 1, 0, 2, 0, "valid"],
          [11, 999, 0, 2, 0, "dangling"],
        ],
      } as unknown as WorkflowJSON,
      "top-level-slot-op".padEnd(32, "0"),
    );

    const graph = remapped as unknown as {
      nodes: Array<{ inputs?: Array<{ link: unknown }>; outputs?: Array<{ links: unknown[] }> }>;
      links: unknown[][];
    };
    expect(graph.nodes[0]!.outputs![0]!.links).toEqual([graph.links[0]![0]]);
    expect(graph.nodes[1]!.inputs![0]!.link).toBeNull();
  });

  it("normalizes string aliases when scrubbing dropped link slot references", () => {
    const remapped = remapInsertedWorkflowIds(
      {
        nodes: [
          { id: 1, type: "Src", outputs: [{ name: "out", links: ["11", 10] }] },
          { id: 2, type: "Sink", inputs: [{ name: "in", link: "11" }] },
        ],
        links: [
          [10, 1, 0, 2, 0, "valid"],
          [11, 999, 0, 2, 0, "dangling"],
        ],
      } as unknown as WorkflowJSON,
      "string-alias-slot-op".padEnd(32, "0"),
    );

    const graph = remapped as unknown as {
      nodes: Array<{ inputs?: Array<{ link: unknown }>; outputs?: Array<{ links: unknown[] }> }>;
      links: unknown[][];
    };
    expect(graph.nodes[0]!.outputs![0]!.links).toEqual([graph.links[0]![0]]);
    expect(graph.nodes[1]!.inputs![0]!.link).toBeNull();
  });

  it.each(["root", "nested"] as const)("preserves null input sentinels beside a literal 'null' link at %s", (scope) => {
    const graph = {
      nodes: [
        { id: 1, type: "Src" },
        {
          id: 2,
          type: "Sink",
          title: `${scope} sentinel sink`,
          inputs: [{ name: "unconnected", link: null }, { name: "connected", link: "null" }],
        },
      ],
      links: [["null", 1, 0, 2, 1, "literal-null-id"]],
    };
    const workflow = scope === "root"
      ? graph
      : { nodes: [], links: [], definitions: { subgraphs: [{ id: "sentinel-def", ...graph }] } };
    const source = structuredClone(workflow);
    const doc = mint({ nodes: [], links: [] }, catalog);
    const op: Op = {
      op: "insert_workflow", workflow, op_id: `sentinel-${scope}`,
      actor: "sentinel", base_version: 1, stamp: [1, "sentinel"],
    };

    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const projected = project(doc, catalog);
    const projectedGraph = (scope === "root"
      ? projected
      : projected.definitions!.subgraphs![0]!) as {
        nodes: Array<{ title?: string; inputs?: Array<{ name: string; link: unknown }> }>;
        links: unknown[][];
      };
    const sink = projectedGraph.nodes!.find((node) => node.title === `${scope} sentinel sink`)!;
    const remappedLinkId = (projectedGraph.links![0] as unknown[])[0];

    expect(sink.inputs).toEqual([
      { name: "unconnected", link: null },
      { name: "connected", link: remappedLinkId },
    ]);
    expect(workflow).toEqual(source);
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
    // Link ids are minted numeric (ADR-033 — `remap.ts`'s `derivedLinkId`),
    // unlike the op-id-embedding derived STRING every other insert_workflow
    // id keeps: ComfyUI_frontend's `LinkId` is a branded `number`.
    expect(typeof linkIds(wf)[1]).toBe("number");
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

  it("retains coherent imported link intent across snapshot and endpoint lifetimes until disconnect", () => {
    const inserted = mint({ nodes: [], links: [] }, catalog);
    const op = insertOp({
      nodes: [
        { id: 1, type: "Src", outputs: [{ name: "out", links: [3] }] },
        { id: 2, type: "Sink", inputs: [{ name: "in", link: 3 }] },
      ],
      links: [[3, 1, 0, 2, 0, "X"]],
    });
    applyOps(inserted, [op], catalog);
    const doc = new Y.Doc();
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(inserted));
    const initial = project(doc, catalog);
    const source = initial.nodes![0]!;
    const target = initial.nodes![1]!;
    const link = initial.links![0] as unknown[];
    const remove = { op: "delete_node", ...env(), node_id: target.id, removed_links: [] } as DeleteNodeOp;
    const readd = {
      op: "add_node", ...env(), node_id: target.id, class_type: target.type, pos: [], node: target,
    } as AddNodeOp;

    applyOps(doc, [remove, readd], catalog);
    expect(project(doc, catalog).links).toEqual([link]);
    expect(project(doc, catalog).nodes!.find(node => node.id === source.id)).toMatchObject({ outputs: [{ links: [link[0]] }] });

    const disconnect = {
      op: "disconnect", ...env(), link_id: link[0], to_node: target.id, to_slot: 0,
    } as DisconnectOp;
    const removeAgain = { op: "delete_node", ...env(), node_id: target.id, removed_links: [] } as DeleteNodeOp;
    const readdAgain = {
      op: "add_node", ...env(), node_id: target.id, class_type: target.type, pos: [], node: target,
    } as AddNodeOp;
    applyOps(doc, [disconnect, removeAgain, readdAgain], catalog);
    expect(project(doc, catalog).links).toEqual([]);
  });

  it("treats an identical define after insertion as the same projected definition", () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    const op = insertOp({
      nodes: [],
      definitions: { subgraphs: [{ id: "raw", name: "D", nodes: [{ id: 1, type: "Inner", widgets_values: ["x"] }], links: [] }] },
    });
    applyOps(doc, [op], catalog);
    const inserted = project(doc, catalog).definitions!.subgraphs![0]! as SubgraphDefinition;
    const define = {
      op: "define_subgraph", ...env(), subgraph_id: inserted.id, subgraph_definition: inserted,
    } as DefineSubgraphOp;
    expect(applyOps(doc, [define], catalog).outcomes[0]?.outcome).toBe("no-op");
    expect(project(doc, catalog).definitions!.subgraphs).toEqual([inserted]);
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
    const run = (ops: Op[]) => replaySnapshot(seed, ops);
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
    const run = (ops: Op[]) => replaySnapshot(seed, ops);

    const deleteThenInsert = run([remove, insert]);
    const insertThenDelete = run([insert, remove]);
    expect(deleteThenInsert).toEqual(insertThenDelete);
    expect(deleteThenInsert.nodes!.filter((node) => typeof node.title === "string" && node.title.startsWith("inserted"))).toHaveLength(2);
    expect(deleteThenInsert.links!.filter((link) => (link as unknown[])[5] === "valid")).toHaveLength(1);
    expect(deleteThenInsert.links!.some((link) => (link as unknown[])[5] === "missing endpoint")).toBe(false);
    expect(deleteThenInsert.groups).toContainEqual({ title: "Inserted group" });
    expect(defIds(deleteThenInsert).some((id) => id !== "def-1" && /^[0-9a-f-]{36}$/.test(id))).toBe(true);
  });

  it("drops both boundary directions and retains only the sibling link and its exact slot references", () => {
    const opId = "0123456789abcdef0123456789abcdef";
    const sourceNodeId = "insert:0123456789abcdef0123456789abcdef:root:node:701";
    const sinkNodeId = "insert:0123456789abcdef0123456789abcdef:root:node:702";
    const workflow = {
      nodes: [
        { id: 701, type: "Src", title: "boundary source", outputs: [{ name: "out", links: [901, 903] }] },
        { id: 702, type: "Sink", title: "boundary sink", inputs: [{ name: "in", link: 902 }, { name: "sibling", link: 903 }] },
      ],
      links: [
        [901, 701, 0, 999, 0, "inserted-to-external"],
        [902, 999, 0, 702, 0, "external-to-inserted"],
        [903, 701, 0, 702, 1, "sibling"],
      ],
    };
    const doc = mint({ nodes: [], links: [] }, catalog);
    const op = insertOp(workflow, { op_id: opId });
    seq--;

    // `remap.ts`'s `derivedLinkId` is a pure function of (opId, scope,
    // original) alone (ADR-033, amended), so the candidate this direct call
    // computes for the surviving link (903, "sibling") is exactly what the
    // real apply below will also compute — independent of what else the
    // target doc holds.
    const remapped = remapInsertedWorkflowIds(workflow as unknown as WorkflowJSON, opId) as unknown as {
      links: Array<[number, ...unknown[]]>;
    };
    const siblingLinkId = remapped.links.find((link) => link[5] === "sibling")![0];
    expect(typeof siblingLinkId).toBe("number");

    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const projected = project(doc, catalog);
    expect(projected.links).toEqual([[siblingLinkId, sourceNodeId, 0, sinkNodeId, 1, "sibling"]]);
    expect(projected.nodes).toEqual([
      expect.objectContaining({ id: sourceNodeId, outputs: [{ name: "out", links: [siblingLinkId] }] }),
      expect.objectContaining({
        id: sinkNodeId,
        inputs: [{ name: "in", link: null }, { name: "sibling", link: siblingLinkId }],
      }),
    ]);
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
    const edit: Op = { ...env(), op: "set_widget", node_id: host.id, path: [host.id, outerNode.id, innerNode.id], inner_widget: "text", widget: "text", value: "after" };

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

  const occupiedIdVectors = [
    {
      kind: "node",
      code: "node_id_collision",
      seed: {
        nodes: [{ id: "insert:c641df0c31f9440b9385ac8e01e099b2:root:node:701", type: "Src", title: "incumbent node" }],
        links: [],
      },
    },
    {
      kind: "definition",
      code: "definition_conflict",
      seed: {
        nodes: [],
        links: [],
        definitions: {
          subgraphs: [{ id: "c7d70ff1-6dca-4b80-83ee-351b8510f528", name: "incumbent definition", nodes: [], links: [] }],
        },
      },
    },
  ] as const;

  for (const vector of occupiedIdVectors) {
    it(`refuses an independently occupied derived ${vector.kind} id byte-identically`, () => {
      // Fixed values were independently produced with Node 22.22.2 node:crypto:
      // node --input-type=module -e 'import{createHash}from"node:crypto";const op="c641df0c31f9440b9385ac8e01e099b2",raw="def-asym",s=`insert:${op}:root:definition:${encodeURIComponent(JSON.stringify(raw))}`,h=createHash("sha256").update(s).digest("hex");console.log(`insert:${op}:root:node:701`,`insert:${op}:root:link:901`,`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`)'
      const doc = mint(vector.seed as unknown as WorkflowJSON, catalog);
      const beforeBytes = bytes(doc);
      const incumbent = project(doc, catalog);
      const op = insertOp(
        {
          nodes: [{ id: 701, type: "def-asym" }, { id: 702, type: "Sink" }],
          links: [[901, 701, 0, 702, 0, "candidate link"]],
          definitions: { subgraphs: [{ id: "def-asym", name: "candidate definition", nodes: [], links: [] }] },
        },
        { op_id: "c641df0c31f9440b9385ac8e01e099b2" },
      );
      seq--;

      expect(rejectedOutcomeWithIndex(applyOps(doc, [op], catalog))).toMatchObject({ index: 0, code: vector.code });
      expect(bytes(doc).equals(beforeBytes)).toBe(true);
      expect(project(doc, catalog)).toEqual(incumbent);
      expect(appliedMap(doc).has(op.op_id)).toBe(false);
    });
  }

  describe("numeric link id minting (ADR-033, pure derivation)", () => {
    it("derives the identical numeric id whether or not that id already exists in the target document", () => {
      // The whole point of the amended design: the candidate is a function
      // of (opId, rawLinkId) ALONE. Computing it against an empty workflow
      // (no document in scope at all) and computing it via a real apply
      // into a doc that starts with unrelated content must agree exactly —
      // there is no document read left in `derivedLinkId` to make them
      // differ.
      const opId = "d641df0c31f9440b9385ac8e01e099b2";
      const expected = derivedLinkIdForTest(opId, 901);

      const doc = mint({ nodes: [{ id: 1, type: "Src" }, { id: 2, type: "Sink" }], links: [[555, 1, 0, 2, 0, "unrelated"]] }, catalog);
      const op = insertOp(
        { nodes: [{ id: 701, type: "Src" }, { id: 702, type: "Sink" }], links: [[901, 701, 0, 702, 0, "candidate link"]] },
        { op_id: opId },
      );
      seq--;

      expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
      const insertedLink = (project(doc, catalog).links as unknown[][]).find((link) => link[5] === "candidate link")!;
      expect(insertedLink[0]).toBe(expected);
    });

    it("rejects, rather than avoids, a genuine collision with a numeric link id already persisted in the doc", () => {
      // Christian Byrne's blocker on the original revision: making the mint
      // AVOID an occupied candidate is exactly what made link identity
      // arrival-order-dependent. The amended mint never reads the document,
      // so an incumbent occupying the derived candidate is no longer
      // side-stepped — it is caught by `acceptsLink`'s ordinary, pre-existing
      // id-collision check (the same one every other `insert_workflow` id
      // kind already goes through), which rejects the WHOLE op rather than
      // silently reassigning a different id to the colliding link.
      const opId = "d641df0c31f9440b9385ac8e01e099b2";
      const occupied = derivedLinkIdForTest(opId, 901);

      const doc = mint(
        { nodes: [{ id: 1, type: "Src" }, { id: 2, type: "Sink" }], links: [[occupied, 1, 0, 2, 0, "incumbent link"]] },
        catalog,
      );
      const before = bytes(doc);
      const beforeProjected = project(doc, catalog);
      const op = insertOp(
        { nodes: [{ id: 701, type: "Src" }, { id: 702, type: "Sink" }], links: [[901, 701, 0, 702, 0, "candidate link"]] },
        { op_id: opId },
      );
      seq--;

      expect(rejectedOutcomeWithIndex(applyOps(doc, [op], catalog))).toMatchObject({ index: 0, code: "link_id_collision" });
      expect(bytes(doc).equals(before)).toBe(true);
      expect(project(doc, catalog)).toEqual(beforeProjected);
      expect(appliedMap(doc).has(op.op_id)).toBe(false);
    });
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

// Declared last in the file: every other test's expectations embed op_ids
// derived from the shared `seq` counter `env()` advances, so a new test
// declared earlier would shift them all.
describe("insert_workflow: subgraph instance nested inside another subgraph", () => {
  it("remaps an interior node that is itself a subgraph instance of a FLAT SIBLING definition", () => {
    // litegraph's own serializer (`LGraph.asSerialisable`, `findUsedSubgraphIds`)
    // never nests a definition inside another definition's own
    // `definitions.subgraphs` — it collects every used subgraph, however
    // deeply an instance sits, into ONE flat top-level list. A subgraph
    // definition nested inside another subgraph (as opposed to two
    // independently-instantiated definitions, see "materializes two distinct
    // subgraph definitions..." in ComfyUI_frontend) is expressed this way:
    // "outer" and "leaf" are flat siblings here, and "outer"'s own interior
    // node names "leaf" by id in its `type` field, exactly as an interior
    // SubgraphNode instance does. Contrast with
    // "stores nested definitions as addressable maps for later interior
    // set_widget" above, which covers the OTHER shape this op supports: a
    // definition genuinely nested in the JSON via `definitions.subgraphs`.
    const doc = mint(baseWorkflow(), catalog);
    const op = insertOp({
      nodes: [],
      links: [],
      definitions: {
        subgraphs: [
          { id: "leaf", name: "Leaf", nodes: [{ id: 1, type: "Inner", widgets_values: ["v"] }], links: [] },
          { id: "outer", name: "Outer", nodes: [{ id: 2, type: "leaf" }], links: [] },
        ],
      },
    });

    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const definitions = project(doc, catalog).definitions!.subgraphs! as Array<Record<string, unknown>>;
    const leaf = definitions.find((definition) => definition["name"] === "Leaf")!;
    const outer = definitions.find((definition) => definition["name"] === "Outer")!;
    const interiorType = String(((outer["nodes"] as Array<{ type: unknown }>)[0]!).type);

    // Before the fix this stayed "leaf" — the un-remapped, un-registered
    // raw id nothing else in the document carries — instead of resolving to
    // the SAME id the leaf definition itself was remapped to.
    expect(interiorType).toBe(String(leaf["id"]));
    expect(interiorType).not.toBe("leaf");
  });
});
