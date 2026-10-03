/**
 * `insert_workflow` numeric group ids.
 *
 * ComfyUI_frontend validates every workflow it loads against its zod schema,
 * where a group's `id` is `z.number().optional()` — at the root and inside
 * `definitions.subgraphs[].groups`. `remap.ts` used to give groups the string
 * `derivedId` (`insert:<opId>:<scope>:group:<original>`) every other kind
 * gets, so a workflow inserted with groups projected ids the frontend refuses:
 *
 *   Invalid workflow against zod schema: Expected number, received string at
 *   "definitions.subgraphs[0].groups[0].id"
 *
 * The frontend then keeps its own copy of the graph and stops taking the
 * document's projection, so later edits land in the document but never on the
 * canvas. Groups now get the same pure numeric derivation links do
 * (ADR-033): a function of the op's own content, never of document state.
 *
 * A document that already stores the old string form projects it through the
 * same hash, so it reads back as the number a fresh insert of that op derives.
 */
import { describe, expect, it } from "vitest";

import { applyOps, mint, project, type Op, type WidgetCatalog, type WorkflowJSON } from "../src/index.js";
import { noOpIds } from "./apply-result-helpers.js";

const DEF = "5d1f2c8e-7a3b-4c9d-8e2f-1a2b3c4d5e6f";

const catalog: WidgetCatalog = {
  types: {
    Src: { widget_order: [] },
    Sink: { widget_order: [] },
    [DEF]: { widget_order: [] },
  },
};

let seq = 0;
function insert(workflow: unknown, opId?: string): Op {
  const op_id = opId ?? ("g" + String(seq++).padStart(4, "0")).padEnd(32, "0");
  return { op: "insert_workflow", op_id, actor: "a", base_version: 1, stamp: [1, "a"], workflow } as unknown as Op;
}

const group = (id: unknown, title: string) => ({ id, title, bounding: [0, 0, 100, 100] });

function withGroups(): WorkflowJSON {
  return {
    nodes: [
      { id: 1, type: "Src" },
      { id: 2, type: DEF },
    ],
    links: [],
    groups: [group(1, "root one"), group(2, "root two")],
    definitions: {
      subgraphs: [
        {
          id: DEF,
          name: "Inner",
          inputs: [],
          outputs: [],
          nodes: [{ id: 10, type: "Sink" }],
          links: [],
          groups: [group(1, "inner one"), group(7, "inner two")],
        },
      ],
    },
  } as unknown as WorkflowJSON;
}

type Grouped = { groups?: Array<{ id?: unknown; title: string }> };
const rootGroups = (wf: WorkflowJSON) => ((wf as Grouped).groups ?? []);
const definitionGroups = (wf: WorkflowJSON) =>
  ((wf["definitions"] as { subgraphs: Grouped[] } | undefined)?.subgraphs ?? []).flatMap((sg) => sg.groups ?? []);

function expectFrontendGroupIds(groups: Array<{ id?: unknown }>): void {
  expect(groups.length).toBeGreaterThan(0);
  for (const g of groups) {
    expect(typeof g.id).toBe("number");
    expect(Number.isSafeInteger(g.id)).toBe(true);
    expect(g.id as number).toBeGreaterThan(0);
  }
}

describe("insert_workflow numeric group ids", () => {
  it("projects numeric ids for root groups and a subgraph definition's groups", () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    expect(applyOps(doc, [insert(withGroups())], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const wf = project(doc, catalog);

    expectFrontendGroupIds(rootGroups(wf));
    expectFrontendGroupIds(definitionGroups(wf));
    expect(rootGroups(wf).map((g) => g.title).sort()).toEqual(["root one", "root two"]);
    expect(definitionGroups(wf).map((g) => g.title).sort()).toEqual(["inner one", "inner two"]);
  });

  it("keeps distinct groups distinct within one op", () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    applyOps(doc, [insert(withGroups())], catalog);
    const wf = project(doc, catalog);
    const ids = [...rootGroups(wf), ...definitionGroups(wf)].map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("derives the same ids for the same op on independent documents", () => {
    const op = insert(withGroups());
    const a = mint({ nodes: [], links: [] }, catalog);
    const b = mint({ nodes: [{ id: 99, type: "Src" }], links: [] } as unknown as WorkflowJSON, catalog);
    applyOps(a, [op], catalog);
    applyOps(b, [op], catalog);
    const ids = (wf: WorkflowJSON) => [...rootGroups(wf), ...definitionGroups(wf)].map((g) => [g.title, g.id]).sort();
    expect(ids(project(a, catalog))).toEqual(ids(project(b, catalog)));
  });

  it("projects the same groups whichever order two group-bearing inserts arrive in", () => {
    const a = insert(withGroups());
    const b = insert({
      nodes: [{ id: 5, type: "Src" }],
      links: [],
      groups: [group(1, "second op one"), group(9, "second op two")],
    });
    const ab = mint({ nodes: [], links: [] }, catalog);
    const ba = mint({ nodes: [], links: [] }, catalog);
    expect(applyOps(ab, [a, b], catalog).outcomes.map((o) => o.outcome)).toEqual(["applied", "applied"]);
    applyOps(ba, [b], catalog);
    applyOps(ba, [a], catalog);

    const wfAB = project(ab, catalog);
    const wfBA = project(ba, catalog);
    expect(rootGroups(wfBA)).toEqual(rootGroups(wfAB));
    expect(definitionGroups(wfBA)).toEqual(definitionGroups(wfAB));
    expectFrontendGroupIds(rootGroups(wfAB));
    // Four root groups from two ops; the same original id (1) in each op stays distinct.
    expect(rootGroups(wfAB)).toHaveLength(4);
    expect(new Set(rootGroups(wfAB).map((g) => g.id)).size).toBe(4);
  });

  it("is a no-op when the same insert is applied again, leaving the groups unchanged", () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    const op = insert(withGroups());
    applyOps(doc, [op], catalog);
    const before = project(doc, catalog);
    const again = applyOps(doc, [op], catalog);
    expect(noOpIds(again)).toEqual([op.op_id]);
    const after = project(doc, catalog);
    expect(rootGroups(after)).toEqual(rootGroups(before));
    expect(definitionGroups(after)).toEqual(definitionGroups(before));
  });

  it("round-trips project → mint → project with the numeric ids unchanged", () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    applyOps(doc, [insert(withGroups())], catalog);
    const once = project(doc, catalog);
    const twice = project(mint(once, catalog), catalog);
    expect(rootGroups(twice)).toEqual(rootGroups(once));
    expect(definitionGroups(twice)).toEqual(definitionGroups(once));
  });

  it("leaves a workflow's own numeric group ids alone when nothing was inserted", () => {
    const wf = project(mint(withGroups(), catalog), catalog);
    expect(rootGroups(wf).map((g) => g.id).sort()).toEqual([1, 2]);
    expect(definitionGroups(wf).map((g) => g.id).sort()).toEqual([1, 7]);
  });

  it("projects a stored legacy string group id as the number a fresh insert of that op derives", () => {
    const opId = "legacy".padEnd(32, "0");
    const fresh = mint({ nodes: [], links: [] }, catalog);
    applyOps(fresh, [insert({ nodes: [{ id: 1, type: "Src" }], links: [], groups: [group(3, "g")] }, opId)], catalog);
    const expected = rootGroups(project(fresh, catalog))[0]!.id;

    const legacyId = `insert:${opId}:root:group:${encodeURIComponent(JSON.stringify(3))}`;
    const legacy = mint(
      {
        nodes: [{ id: 1, type: "Src" }],
        links: [],
        groups: [group(legacyId, "g")],
        definitions: {
          subgraphs: [
            {
              id: DEF,
              name: "Inner",
              inputs: [],
              outputs: [],
              nodes: [],
              links: [],
              groups: [group(`insert:${opId}:root/definition:${encodeURIComponent(JSON.stringify(DEF))}:group:${encodeURIComponent(JSON.stringify(1))}`, "inner")],
            },
          ],
        },
      } as unknown as WorkflowJSON,
      catalog,
    );
    const wf = project(legacy, catalog);
    expect(rootGroups(wf)[0]!.id).toBe(expected);
    expectFrontendGroupIds(definitionGroups(wf));
  });

  it("leaves a plain string group id that insert_workflow never derived unchanged", () => {
    // Only the derived `insert:<opId>:<scope>:group:<original>` form is
    // coerced; any other string id must round-trip project(mint(wf)) == wf.
    const wf = {
      nodes: [{ id: 1, type: "Src" }],
      links: [],
      groups: [group("my-custom-group", "g"), group("insert:not-derived", "h")],
      definitions: {
        subgraphs: [
          { id: DEF, name: "Inner", inputs: [], outputs: [], nodes: [], links: [], groups: [group("inner-custom", "i")] },
        ],
      },
    } as unknown as WorkflowJSON;
    const out = project(mint(wf, catalog), catalog);
    expect(rootGroups(out).map((g) => g.id)).toEqual(["my-custom-group", "insert:not-derived"]);
    expect(definitionGroups(out).map((g) => g.id)).toEqual(["inner-custom"]);
  });
});
