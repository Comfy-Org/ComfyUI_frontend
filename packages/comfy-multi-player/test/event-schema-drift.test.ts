/**
 * Go ⇄ TypeScript event-contract drift guard.
 *
 * Regeneration instructions live in fixtures/go-agent-events/README.md. Never
 * update only the fixture or only `src/event-schema.ts`: advance the pinned
 * cloud SHA, golden samples, schema export, and TS union together.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AGENT_EVENT_JSON_SCHEMA, type AgentEvent } from "../src/event-schema.js";

type Schema = { type?: string | string[]; enum?: string[]; required?: string[]; properties?: Record<string, Schema>; items?: Schema };
type Contract = { cloud_sha: string; events: Record<string, { required: string[]; fields: Record<string, string> }> };
const root = process.cwd();
const fixture = JSON.parse(readFileSync(join(root, "fixtures/go-agent-events/contract.json"), "utf8")) as Contract;

function shape(schema: Schema): string {
  if (schema.enum) return `enum:${schema.enum.join("|")}`;
  if (Array.isArray(schema.type)) {
    const nonNull = schema.type.find((type) => type !== "null");
    if (nonNull === undefined) return "null";
    return `${shape({ ...schema, type: nonNull })}|null`;
  }
  if (schema.type === "array") return `array<${shape(schema.items ?? {})}>`;
  if (schema.type === "object" && schema.properties) {
    const required = schema.required?.join(",") ?? "";
    const fields = Object.entries(schema.properties).map(([name, child]) => `${name}=${shape(child)}`).join(",");
    return `object{required:${required};fields:${fields}}`;
  }
  return schema.type ?? "unknown";
}

function projectedContract() {
  const defs = AGENT_EVENT_JSON_SCHEMA.$defs as Record<string, Schema>;
  return Object.fromEntries(Object.entries(defs).map(([event, envelope]) => {
    const data = envelope.properties?.data;
    if (!data?.properties) throw new Error(`${event}: missing data object schema`);
    return [event, {
      required: data.required ?? [],
      fields: Object.fromEntries(Object.entries(data.properties).map(([name, field]) => [name, shape(field)])),
    }];
  }));
}

describe("cloud Go ⇄ cmp TypeScript event schema", () => {
  it("pins a full cloud commit SHA", () => expect(fixture.cloud_sha).toMatch(/^[0-9a-f]{40}$/));

  it("matches every vendored Go field, type, enum, nullability, and optionality", () => {
    expect(projectedContract()).toEqual(fixture.events);
  });

  it("keeps every Go golden event inside the TypeScript discriminated union", () => {
    const lines = readFileSync(join(root, "fixtures/go-agent-events/golden.jsonl"), "utf8").trim().split("\n");
    const events = lines.map((line) => JSON.parse(line) as AgentEvent);
    expect(events.map((event) => event.type).sort()).toEqual(Object.keys(fixture.events).sort());
  });
});
