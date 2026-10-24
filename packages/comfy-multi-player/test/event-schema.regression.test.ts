/**
 * Regression: the draft-07 export used the post-draft-07 `$defs` keyword, so
 * Ajv 6.15 rejected it when strict keyword checking was enabled.
 * Source: PASS36-R102 / https://github.com/Comfy-Org/ComfyUI_frontend/pull/16644#discussion_r3926225065
 */
import { readFileSync } from "node:fs";
import Ajv from "ajv6";
import { describe, expect, it } from "vitest";
import { AGENT_EVENT_JSON_SCHEMA } from "../src/event-schema.js";

// This exact test-only alias preserves Ajv 6's strict draft-07 compatibility
// check without constraining newer validator tooling or adding a runtime dep.
const ajv = new Ajv({ strictKeywords: true });

describe("draft-07 event schema regression", () => {
  it("regression: compiles with strict draft-07 keyword checking", () => {
    expect(() => ajv.compile(AGENT_EVENT_JSON_SCHEMA)).not.toThrow();
  });

  it("accepts every pinned golden event", () => {
    const validate = ajv.compile(AGENT_EVENT_JSON_SCHEMA);
    const events = readFileSync(new URL("../fixtures/go-agent-events/golden.jsonl", import.meta.url), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as unknown);

    expect(events).toHaveLength(9);
    for (const event of events) expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
  });

  it.each([
    ["wrong field type", { type: "draft_version", data: { workflow_id: "workflow", version: "1" } }],
    ["forbidden extra field", { type: "draft_version", data: { workflow_id: "workflow", version: 1, extra: true } }],
    ["unknown event type", { type: "not_an_agent_event", data: {} }],
  ])("rejects %s", (_label, event) => {
    const validate = ajv.compile(AGENT_EVENT_JSON_SCHEMA);
    expect(validate(event)).toBe(false);
    expect(validate.errors?.length).toBeGreaterThan(0);
  });
});
