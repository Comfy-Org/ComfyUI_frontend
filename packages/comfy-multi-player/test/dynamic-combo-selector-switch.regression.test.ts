/**
 * Switching a dynamic-combo selector on a node added with its default option
 * reshapes the node's slots to the new option.
 *
 * GeminiNodeV3's default option ("Gemini 3.8 Flash") carries
 * `video_processing` and no `temperature` / `top_p`; the other options carry
 * `temperature` / `top_p` and no `video_processing`. A value-blind layout keeps
 * the default option's slots after `set_widget model "Gemini 3.1 Pro"`, so
 * `model.temperature` is refused as unknown, and a reader that lays the
 * positional `widgets_values` out for the selected option reads every value one
 * slot off (`thinking_level = "static"`, `top_p = 8192`, `seed = "fixed"`).
 *
 * The catalog entry is the one comfy-cli `nodes widget-catalog` publishes for
 * this class, verbatim (fixtures/gemini-node-v3.widget-catalog.json).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  applyOps,
  mint,
  project,
  type Op,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";

const entry = JSON.parse(
  readFileSync(
    new URL("./fixtures/gemini-node-v3.widget-catalog.json", import.meta.url),
    "utf8",
  ),
) as Record<string, unknown>;
const catalog = { types: { GeminiNodeV3: entry } } as unknown as WidgetCatalog;

let seq = 0;
function stamped(fields: Record<string, unknown>): Op {
  const n = ++seq;
  return {
    op_id: ("gm" + String(n).padStart(4, "0")).padEnd(32, "0"),
    actor: "agent:a",
    base_version: n,
    stamp: [n, "agent:a"],
    ...fields,
  } as unknown as Op;
}

const setWidget = (widget: string, value: unknown): Op =>
  stamped({ op: "set_widget", node_id: 7, widget, value });

function freshGemini() {
  const doc = mint(
    { nodes: [], links: [] } as unknown as WorkflowJSON,
    catalog,
  );
  const added = applyOps(
    doc,
    [
      stamped({
        op: "add_node",
        node_id: 7,
        class_type: "GeminiNodeV3",
        pos: [0, 0],
        // The default option's values, as a freshly added node holds them.
        node: {
          id: 7,
          type: "GeminiNodeV3",
          pos: [0, 0],
          widgets_values: [
            "Gemini 3.8 Flash",
            "",
            "static",
            "MEDIUM",
            32768,
            42,
            "fixed",
            "",
          ],
        },
      }),
    ],
    catalog,
  );
  expect(added.outcomes[0]).toMatchObject({ outcome: "applied" });
  return doc;
}

const values = (doc: ReturnType<typeof mint>) =>
  project(doc, catalog).nodes![0]!.widgets_values;

describe("dynamic combo: switching away from the default option on a fresh node", () => {
  it("lays the node out for the selected option", () => {
    const doc = freshGemini();
    expect(
      applyOps(doc, [setWidget("model", "Gemini 3.1 Pro")], catalog)
        .outcomes[0],
    ).toMatchObject({
      outcome: "applied",
    });
    // prompt, thinking_level, temperature, top_p, max_output_tokens, seed, control_after_generate, system_prompt.
    // thinking_level is a name both options own, so it is one slot and keeps the value the node holds
    // (dynamic-combos.ts); temperature and top_p show the selected option's defaults.
    expect(values(doc)).toEqual([
      "Gemini 3.1 Pro",
      "",
      "MEDIUM",
      1.0,
      0.95,
      32768,
      42,
      "fixed",
      "",
    ]);
  });

  it("accepts the selected option's own sub-widgets and writes them to their slots", () => {
    const doc = freshGemini();
    const result = applyOps(
      doc,
      [
        setWidget("model", "Gemini 3.1 Pro"),
        setWidget("model.temperature", 0.7),
        setWidget("model.top_p", 0.9),
        setWidget("model.max_output_tokens", 8192),
      ],
      catalog,
    );
    expect(result.outcomes.map((o) => o.outcome)).toEqual([
      "applied",
      "applied",
      "applied",
      "applied",
    ]);
    expect(values(doc)).toEqual([
      "Gemini 3.1 Pro",
      "",
      "MEDIUM",
      0.7,
      0.9,
      8192,
      42,
      "fixed",
      "",
    ]);
  });
});
