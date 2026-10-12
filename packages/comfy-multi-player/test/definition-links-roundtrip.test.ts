/**
 * A subgraph definition's interior `links` round-trip through mint → project
 * as EIGHTEEN DISTINCT links, not eighteen copies of the last one.
 *
 * Found in production (Langfuse, 2026-08-25..28, the second-largest error
 * cluster): for the z-image turbo template (definition `f2fdebf6-…`, instance
 * 57) `mint()` + `project()` turned the definition's 18 interior links into 18
 * copies of link 75. The frontend serializes a definition's interior links as
 * OBJECTS — `{id, origin_id, origin_slot, target_id, target_slot, type}` — not
 * the top-level litegraph tuple, and `mintDefinition` keyed every link by
 * `link[0]`, which reads `undefined` off an object, so all 18 collapsed onto
 * the key `"undefined"` and `link_order` replayed that one entry 18 times.
 * Downstream, `validate` then reported `required_input_missing 'images'` on
 * the SaveImage fed by subgraph 57 (the definition's IMAGE output link 16 was
 * gone) and the in-app agent destroyed the subgraph to ship. The raw template
 * validates clean in comfy-cli, because comfy-cli never re-keys the links.
 *
 * The 18 links below are the template's, verbatim and in authored order.
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { mint, project, type WidgetCatalog, type WorkflowJSON } from "../src/index.js";
import { loadCatalog } from "./helpers.js";

const DEF = "f2fdebf6-dfaf-43b6-9eb2-7f70613cfdc1";

/** `definitions.subgraphs[0].links` of workflow_templates `image_z_image_turbo.json`, verbatim. */
const TEMPLATE_LINKS = [
  { id: 32, origin_id: 27, origin_slot: 0, target_id: 33, target_slot: 0, type: "CONDITIONING" },
  { id: 26, origin_id: 28, origin_slot: 0, target_id: 11, target_slot: 0, type: "MODEL" },
  { id: 14, origin_id: 3, origin_slot: 0, target_id: 8, target_slot: 0, type: "LATENT" },
  { id: 27, origin_id: 29, origin_slot: 0, target_id: 8, target_slot: 1, type: "VAE" },
  { id: 13, origin_id: 11, origin_slot: 0, target_id: 3, target_slot: 0, type: "MODEL" },
  { id: 30, origin_id: 27, origin_slot: 0, target_id: 3, target_slot: 1, type: "CONDITIONING" },
  { id: 33, origin_id: 33, origin_slot: 0, target_id: 3, target_slot: 2, type: "CONDITIONING" },
  { id: 17, origin_id: 13, origin_slot: 0, target_id: 3, target_slot: 3, type: "LATENT" },
  { id: 28, origin_id: 30, origin_slot: 0, target_id: 27, target_slot: 0, type: "CLIP" },
  { id: 16, origin_id: 8, origin_slot: 0, target_id: -20, target_slot: 0, type: "IMAGE" },
  { id: 34, origin_id: -10, origin_slot: 0, target_id: 27, target_slot: 1, type: "STRING" },
  { id: 35, origin_id: -10, origin_slot: 1, target_id: 13, target_slot: 0, type: "INT" },
  { id: 36, origin_id: -10, origin_slot: 2, target_id: 13, target_slot: 1, type: "INT" },
  { id: 71, origin_id: -10, origin_slot: 3, target_id: 3, target_slot: 4, type: "INT" },
  { id: 72, origin_id: -10, origin_slot: 4, target_id: 3, target_slot: 5, type: "INT" },
  { id: 73, origin_id: -10, origin_slot: 5, target_id: 28, target_slot: 0, type: "COMBO" },
  { id: 74, origin_id: -10, origin_slot: 6, target_id: 30, target_slot: 0, type: "COMBO" },
  { id: 75, origin_id: -10, origin_slot: 7, target_id: 29, target_slot: 0, type: "COMBO" },
];

/** The template's interior nodes by id/type; widget values omitted so the pinned catalog need not describe every class. */
const TEMPLATE_NODES = [
  { id: 30, type: "CLIPLoader" },
  { id: 29, type: "VAELoader" },
  { id: 33, type: "ConditioningZeroOut" },
  { id: 8, type: "VAEDecode" },
  { id: 28, type: "UNETLoader" },
  { id: 27, type: "CLIPTextEncode" },
  { id: 13, type: "EmptySD3LatentImage" },
  { id: 11, type: "ModelSamplingAuraFlow" },
  { id: 3, type: "KSampler" },
].map((n) => ({ ...n, inputs: [], outputs: [] }));

function zImageTemplate(): WorkflowJSON {
  return {
    last_node_id: 57,
    last_link_id: 75,
    nodes: [
      { id: 9, type: "SaveImage", inputs: [{ name: "images", type: "IMAGE", link: 62 }], outputs: [], widgets_values: ["z-image-turbo"] },
      {
        id: 57,
        type: DEF,
        inputs: [{ name: "text", type: "STRING", link: null, widget: { name: "text" } }],
        outputs: [{ name: "IMAGE", type: "IMAGE", links: [62] }],
        widgets_values: [],
      },
    ],
    links: [[62, 57, 0, 9, 0, "IMAGE"]],
    definitions: {
      subgraphs: [
        {
          id: DEF,
          name: "Text to Image (Z-Image-Turbo)",
          inputs: [{ name: "text", type: "STRING", linkIds: [34] }],
          outputs: [{ id: "1fa72a21-ce00-4952-814e-1f2ffbe87d1d", name: "IMAGE", type: "IMAGE", linkIds: [16] }],
          nodes: TEMPLATE_NODES,
          links: TEMPLATE_LINKS.map((l) => ({ ...l })),
        },
      ],
    },
  } as unknown as WorkflowJSON;
}

const catalog: WidgetCatalog = loadCatalog();
const interiorLinks = (wf: WorkflowJSON) =>
  (wf["definitions"] as { subgraphs: { links: unknown[] }[] }).subgraphs[0]!.links;

function withInteriorLinks(links: unknown[]): WorkflowJSON {
  const wf = zImageTemplate();
  (wf["definitions"] as { subgraphs: { links: unknown[] }[] }).subgraphs[0]!.links = links;
  return wf;
}

function interiorLinkStorage(doc: Y.Doc): { keys: string[]; order: string[] } {
  const definition = doc.getMap<Y.Map<unknown>>("definitions").get(DEF)!;
  const links = definition.get("links") as Y.Map<unknown>;
  return {
    keys: [...links.keys()],
    order: definition.get("link_order") as string[],
  };
}

describe("mint → project keeps a definition's interior links distinct (frontend object form)", () => {
  it("round-trips all 18 links of the z-image turbo definition with exact ids, origins, targets and slots, in authored order", () => {
    const out = project(mint(zImageTemplate(), catalog), catalog);
    const links = interiorLinks(out);
    expect(links).toHaveLength(18);
    expect(links).toEqual(TEMPLATE_LINKS);
    expect(links.map((l) => (l as { id: number }).id)).toEqual([32, 26, 14, 27, 13, 30, 33, 17, 28, 16, 34, 35, 36, 71, 72, 73, 74, 75]);
    // The regression's exact symptom: 18 copies of the last link, 75.
    expect(new Set(links.map((l) => (l as { id: number }).id)).size).toBe(18);
  });

  it("keeps the IMAGE output link (16 → outputNode -20) that feeds SaveImage 9 through instance 57", () => {
    const out = project(mint(zImageTemplate(), catalog), catalog);
    expect(interiorLinks(out)).toContainEqual({ id: 16, origin_id: 8, origin_slot: 0, target_id: -20, target_slot: 0, type: "IMAGE" });
    expect(out.links).toEqual([[62, 57, 0, 9, 0, "IMAGE"]]);
    expect(out.nodes.find((n) => n.id === 9)!.inputs).toEqual([{ name: "images", type: "IMAGE", link: 62 }]);
  });

  it("still keys the litegraph TUPLE form by link[0], and an id-less entry by its position rather than 'undefined'", () => {
    const wf = zImageTemplate();
    const sg = (wf["definitions"] as { subgraphs: { links: unknown[] }[] }).subgraphs[0]!;
    sg.links = [
      [1, 27, 0, 33, 0, "CONDITIONING"],
      [2, 28, 0, 11, 0, "MODEL"],
      { origin_id: 3, origin_slot: 0, target_id: 8, target_slot: 0, type: "LATENT" },
      { origin_id: 29, origin_slot: 0, target_id: 8, target_slot: 1, type: "VAE" },
    ];
    const out = project(mint(wf, catalog), catalog);
    expect(interiorLinks(out)).toEqual(sg.links);
  });

  it("reserves a later explicit '#0' before allocating the id-less link at position zero", () => {
    const idless = { origin_id: 101, origin_slot: 1, target_id: 102, target_slot: 2, type: "IDLESS" };
    const explicit = { id: "#0", origin_id: 201, origin_slot: 3, target_id: 202, target_slot: 4, type: "EXPLICIT" };
    const doc = mint(withInteriorLinks([idless, explicit]), catalog);

    expect(interiorLinks(project(doc, catalog))).toEqual([idless, explicit]);
    expect(interiorLinkStorage(doc)).toEqual({ keys: ["#0~1", "#0"], order: ["#0~1", "#0"] });
  });

  it("preserves reverse-order noncollision keys and exact asymmetric projected values", () => {
    const explicit = { id: "#0", origin_id: 301, origin_slot: 5, target_id: 302, target_slot: 6, type: "EXPLICIT-FIRST" };
    const idless = { origin_id: 401, origin_slot: 7, target_id: 402, target_slot: 8, type: "IDLESS-SECOND" };
    const doc = mint(withInteriorLinks([explicit, idless]), catalog);

    expect(interiorLinks(project(doc, catalog))).toEqual([explicit, idless]);
    expect(interiorLinkStorage(doc)).toEqual({ keys: ["#0", "#1"], order: ["#0", "#1"] });
  });

  it("loops past explicit suffix adversaries while keeping every internal key and order entry unique", () => {
    const idless = { origin_id: 501, origin_slot: 9, target_id: 502, target_slot: 10, type: "IDLESS" };
    const explicitBase = { id: "#0", origin_id: 601, origin_slot: 11, target_id: 602, target_slot: 12, type: "BASE" };
    const explicitSuffix = { id: "#0~1", origin_id: 701, origin_slot: 13, target_id: 702, target_slot: 14, type: "SUFFIX" };
    const doc = mint(withInteriorLinks([idless, explicitBase, explicitSuffix]), catalog);
    const storage = interiorLinkStorage(doc);

    expect(interiorLinks(project(doc, catalog))).toEqual([idless, explicitBase, explicitSuffix]);
    expect(storage).toEqual({ keys: ["#0~2", "#0", "#0~1"], order: ["#0~2", "#0", "#0~1"] });
    expect(new Set(storage.keys).size).toBe(3);
    expect(new Set(storage.order).size).toBe(3);
  });

  it("reserves normalized tuple IDs before allocating synthetic keys", () => {
    const idless = { origin_id: 801, origin_slot: 15, target_id: 802, target_slot: 16, type: "IDLESS" };
    const tuple = ["#0", 901, 17, 902, 18, "TUPLE"];
    const doc = mint(withInteriorLinks([idless, tuple]), catalog);

    expect(interiorLinks(project(doc, catalog))).toEqual([idless, tuple]);
    expect(interiorLinkStorage(doc)).toEqual({ keys: ["#0~1", "#0"], order: ["#0~1", "#0"] });
  });

  it.each([
    ["tuple then object", [[1, 1001, 19, 1002, 20, "TUPLE-FIRST"], { id: "1", origin_id: 1101, origin_slot: 21, target_id: 1102, target_slot: 22, type: "OBJECT-SECOND" }]],
    ["object then tuple", [{ id: "1", origin_id: 1201, origin_slot: 23, target_id: 1202, target_slot: 24, type: "OBJECT-FIRST" }, [1, 1301, 25, 1302, 26, "TUPLE-SECOND"]]],
  ])("refuses duplicate explicit normalized link IDs in %s order", (_name, links) => {
    expect(() => mint(withInteriorLinks(links), catalog)).toThrow(new TypeError("mint: duplicate definition link id '1'"));
  });

  it("accepts distinct normalized tuple and object IDs with exact asymmetric payloads", () => {
    const tuple = [1, 1401, 27, 1402, 28, "TUPLE"];
    const object = { id: "2", origin_id: 1501, origin_slot: 29, target_id: 1502, target_slot: 30, type: "OBJECT" };
    const doc = mint(withInteriorLinks([tuple, object]), catalog);

    expect(interiorLinks(project(doc, catalog))).toEqual([tuple, object]);
    expect(interiorLinkStorage(doc)).toEqual({ keys: ["1", "2"], order: ["1", "2"] });
  });
});
