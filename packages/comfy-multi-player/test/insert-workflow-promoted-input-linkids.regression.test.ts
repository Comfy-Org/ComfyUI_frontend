/**
 * An `insert_workflow` must keep a subgraph definition's promoted inputs wired.
 *
 * `remapInsertedWorkflowIds` derives new ids for everything an insertion op
 * carries, and `remapGraph` rewrites interior `nodes[].inputs[].link`,
 * `nodes[].outputs[].links[]`, the `links` entries' own ids, and `groups` ids.
 * It used to never touch `graph["inputs"]` — a subgraph DEFINITION's own
 * promoted (exposed-widget) declarations, each of which carries a `linkIds`
 * array naming the interior links that feed that promoted input.
 * `mintDefinition` stores the `inputs` array verbatim, so after an
 * `insert_workflow` the definition landed in the document with `links` keyed
 * by the NEW derived ids while `inputs[].linkIds` still named the OLD
 * pre-remap ids.
 *
 * Downstream (ComfyUI_frontend, `agentSubgraphHostSlots.ts`)
 * `promotedWidgetNames()` resolves each `inputs[].linkIds` entry against the
 * definition's own `links` and silently treats a miss as "not promoted", so
 * every declared input reported as unpromoted and the definition promoted 0
 * widgets while the host node's opaque `widgets_values` still carried the
 * blueprint's N values. That mismatch is what the staging telemetry reports as
 * "... carries 13 opaque widget values but its definition promotes 0".
 *
 * A second defect sat underneath it: a promoted input is normally fed from the
 * definition's synthetic INPUT NODE (litegraph's `origin_id: -10`; the exposed
 * output side is `target_id: -20`), which is not a member of the definition's
 * `nodes` array. `remapGraph` drops dangling links inside a definition, and
 * the endpoint check counted those sentinels as missing nodes, so the whole
 * link was dropped and the promoted input had nothing left to name. Natively
 * authored (`define_subgraph`) definitions never hit this because they are not
 * remapped; only the `insert_workflow` path was affected.
 */
import { describe, expect, it } from "vitest";

import { remapInsertedWorkflowIds } from "../src/remap.js";
import type { WorkflowJSON } from "../src/index.js";

const DEF = "promoted-text-def";
/** The interior link that feeds the promoted `text` widget. */
const INTERIOR_LINK_ID = 34;

type RemappedDefinition = {
  id: unknown;
  inputs: Array<{ name: string; linkIds: unknown[] }>;
  outputs: Array<{ name: string; linkIds: unknown[] }>;
  nodes: Array<{ id: unknown; inputs?: Array<{ link: unknown }>; outputs?: Array<{ links: unknown[] }> }>;
  links: Array<{ id: unknown; origin_id?: unknown; target_id?: unknown }>;
};

/**
 * One subgraph definition with one promoted input, wired by one interior link
 * whose endpoints are both interior nodes (so the link survives the
 * dangling-link drop and the only thing under test is the id rewrite).
 */
function promotedBlueprint(): WorkflowJSON {
  return {
    last_node_id: 100,
    last_link_id: INTERIOR_LINK_ID,
    nodes: [
      {
        id: 100,
        type: DEF,
        inputs: [{ name: "text", type: "STRING", link: null, widget: { name: "text" } }],
        outputs: [],
        widgets_values: ["a prompt from the blueprint"],
      },
    ],
    links: [],
    definitions: {
      subgraphs: [
        {
          id: DEF,
          name: "Promoted text",
          inputs: [{ name: "text", type: "STRING", linkIds: [INTERIOR_LINK_ID] }],
          outputs: [],
          nodes: [
            { id: 10, type: "PrimitiveString", inputs: [], outputs: [{ name: "STRING", type: "STRING", links: [INTERIOR_LINK_ID] }] },
            {
              id: 11,
              type: "CLIPTextEncode",
              inputs: [{ name: "text", type: "STRING", link: INTERIOR_LINK_ID, widget: { name: "text" } }],
              outputs: [],
            },
          ],
          links: [{ id: INTERIOR_LINK_ID, origin_id: 10, origin_slot: 0, target_id: 11, target_slot: 0, type: "STRING" }],
        },
      ],
    },
  } as unknown as WorkflowJSON;
}

/**
 * The shape a real template actually carries (z-image turbo, and the
 * `fixtures/session-promoted-host` session): the promoted input is fed
 * straight from the definition's synthetic INPUT NODE (`origin_id: -10`) and
 * the exposed output runs to the synthetic OUTPUT NODE (`target_id: -20`).
 * Neither sentinel is a member of `nodes`.
 */
function sentinelBlueprint(): WorkflowJSON {
  return {
    last_node_id: 100,
    last_link_id: 16,
    nodes: [
      {
        id: 100,
        type: DEF,
        inputs: [{ name: "text", type: "STRING", link: null, widget: { name: "text" } }],
        outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }],
        widgets_values: ["a prompt from the blueprint"],
      },
    ],
    links: [],
    definitions: {
      subgraphs: [
        {
          id: DEF,
          name: "Promoted text",
          inputs: [{ name: "text", type: "STRING", linkIds: [INTERIOR_LINK_ID] }],
          outputs: [{ name: "IMAGE", type: "IMAGE", linkIds: [16] }],
          nodes: [
            {
              id: 27,
              type: "CLIPTextEncode",
              inputs: [{ name: "text", type: "STRING", link: INTERIOR_LINK_ID, widget: { name: "text" } }],
              outputs: [],
            },
            { id: 8, type: "VAEDecode", inputs: [], outputs: [{ name: "IMAGE", type: "IMAGE", links: [16] }] },
          ],
          links: [
            { id: INTERIOR_LINK_ID, origin_id: -10, origin_slot: 0, target_id: 27, target_slot: 1, type: "STRING" },
            { id: 16, origin_id: 8, origin_slot: 0, target_id: -20, target_slot: 0, type: "IMAGE" },
          ],
        },
      ],
    },
  } as unknown as WorkflowJSON;
}

function remapDefinition(blueprint: WorkflowJSON, opId: string): RemappedDefinition {
  const remapped = remapInsertedWorkflowIds(blueprint, opId) as unknown as {
    definitions: { subgraphs: RemappedDefinition[] };
  };
  return remapped.definitions.subgraphs[0]!;
}

function remappedDefinition(opId: string): RemappedDefinition {
  return remapDefinition(promotedBlueprint(), opId);
}

describe("insert_workflow remap keeps a definition's promoted inputs wired", () => {
  it("rewrites inputs[].linkIds to the remapped interior link ids", () => {
    const definition = remappedDefinition("promoted-linkids-op".padEnd(32, "0"));

    // Preconditions: the interior link survived and was given a new derived id.
    expect(definition.links).toHaveLength(1);
    expect(definition.links[0]!.id).not.toBe(INTERIOR_LINK_ID);
    expect(definition.nodes[1]!.inputs![0]!.link).toBe(definition.links[0]!.id);

    // The defect: the promoted input still names the pre-remap link id, so it
    // resolves against nothing in the definition's own remapped `links`.
    const remappedLinkIds = new Set(definition.links.map((link) => String(link.id)));
    expect(definition.inputs[0]!.linkIds.map(String)).toEqual([String(definition.links[0]!.id)]);
    for (const linkId of definition.inputs[0]!.linkIds) {
      expect(remappedLinkIds.has(String(linkId))).toBe(true);
    }
  });

  it("keeps a link fed by the subgraph IO sentinels and rewrites the declarations that name it", () => {
    const definition = remapDefinition(sentinelBlueprint(), "sentinel-linkids-op".padEnd(32, "0"));

    // Neither sentinel-touching link is a dangling link: both survive.
    expect(definition.links).toHaveLength(2);
    const promotedLink = definition.links[0]!;
    const exposedLink = definition.links[1]!;

    // The synthetic IO node ids are NOT remapped — they stay the sentinels the
    // frontend resolves against.
    expect(promotedLink.origin_id).toBe(-10);
    expect(exposedLink.target_id).toBe(-20);

    // Interior endpoints and the links' own ids are remapped as usual.
    expect(promotedLink.id).not.toBe(INTERIOR_LINK_ID);
    expect(definition.nodes[0]!.inputs![0]!.link).toBe(promotedLink.id);
    expect(definition.nodes[1]!.outputs![0]!.links).toEqual([exposedLink.id]);

    // And the definition's own declarations name the remapped ids.
    expect(definition.inputs[0]!.linkIds).toEqual([promotedLink.id]);
    expect(definition.outputs[0]!.linkIds).toEqual([exposedLink.id]);
  });
});
