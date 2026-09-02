/**
 * Agent broadcast event contract shared by Go producers and TypeScript consumers.
 *
 * Keep this dependency-free: cmp must remain portable with `yjs` as its only
 * runtime dependency (KA-3 / FC-3). `AGENT_EVENT_JSON_SCHEMA` is suitable for
 * JSON Schema draft-07 validators; the TypeScript union below is the consumer
 * compile-time surface.
 */

export interface DraftPatchEvent {
  type: "draft_patch";
  data: { workflow_id: string; content: Record<string, unknown>; version: number; base_version: number; thread_id: string; message_id: string };
}
export interface DraftVersionEvent { type: "draft_version"; data: { workflow_id: string; version: number } }
export interface AgentMessageDeltaEvent { type: "agent_message_delta"; data: { thread_id: string; message_id: string; delta: string } }
export interface AgentToolCallEvent {
  type: "agent_tool_call";
  data: { thread_id: string; message_id: string; tool_call_id: string; tool_name: string; status: "running" | "success" | "error"; duration_ms?: number; error_code?: string };
}
export interface AgentMessageDoneEvent { type: "agent_message_done"; data: { thread_id: string; message_id: string; usage: { input: number; output: number } } }
export interface AgentAskEvent {
  type: "agent_ask";
  data: { thread_id: string; message_id: string; ask_id: string; prompt: string; options: Array<{ id: string; label: string; description?: string }>; min_selections: number; max_selections: number; allow_other: boolean };
}
export interface AgentAskResolvedEvent { type: "agent_ask_resolved"; data: { thread_id: string; message_id: string; ask_id: string; status: "answered" | "cancelled" | "expired"; selected: string[] | null } }
export interface AgentActiveTabEvent { type: "agent_active_tab"; data: { workflow_id: string; name?: string; thread_id: string; message_id: string } }
export interface AgentAssetEvent { type: "agent_asset"; data: { hash: string; asset_id?: string; media_type?: string; name?: string; thread_id: string; message_id: string } }

export type AgentEvent =
  | DraftPatchEvent | DraftVersionEvent | AgentMessageDeltaEvent
  | AgentToolCallEvent | AgentMessageDoneEvent | AgentAskEvent
  | AgentAskResolvedEvent | AgentActiveTabEvent | AgentAssetEvent;

type JsonSchema = Readonly<Record<string, unknown>>;
const string = { type: "string" } as const;
const integer = { type: "integer" } as const;

function envelope(type: AgentEvent["type"], required: readonly string[], properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: "object", additionalProperties: false, required: ["type", "data"],
    properties: {
      type: { const: type },
      data: { type: "object", additionalProperties: false, required, properties },
    },
  };
}

const defs = {
  draft_patch: envelope("draft_patch", ["workflow_id", "content", "version", "base_version", "thread_id", "message_id"], { workflow_id: string, content: { type: "object" }, version: integer, base_version: integer, thread_id: string, message_id: string }),
  draft_version: envelope("draft_version", ["workflow_id", "version"], { workflow_id: string, version: integer }),
  agent_message_delta: envelope("agent_message_delta", ["thread_id", "message_id", "delta"], { thread_id: string, message_id: string, delta: string }),
  agent_tool_call: envelope("agent_tool_call", ["thread_id", "message_id", "tool_call_id", "tool_name", "status"], { thread_id: string, message_id: string, tool_call_id: string, tool_name: string, status: { enum: ["running", "success", "error"] }, duration_ms: integer, error_code: string }),
  agent_message_done: envelope("agent_message_done", ["thread_id", "message_id", "usage"], { thread_id: string, message_id: string, usage: { type: "object", additionalProperties: false, required: ["input", "output"], properties: { input: integer, output: integer } } }),
  agent_ask: envelope("agent_ask", ["thread_id", "message_id", "ask_id", "prompt", "options", "min_selections", "max_selections", "allow_other"], { thread_id: string, message_id: string, ask_id: string, prompt: string, options: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "label"], properties: { id: string, label: string, description: string } } }, min_selections: integer, max_selections: integer, allow_other: { type: "boolean" } }),
  agent_ask_resolved: envelope("agent_ask_resolved", ["thread_id", "message_id", "ask_id", "status", "selected"], { thread_id: string, message_id: string, ask_id: string, status: { enum: ["answered", "cancelled", "expired"] }, selected: { type: ["array", "null"], items: string } }),
  agent_active_tab: envelope("agent_active_tab", ["workflow_id", "thread_id", "message_id"], { workflow_id: string, name: string, thread_id: string, message_id: string }),
  agent_asset: envelope("agent_asset", ["hash", "thread_id", "message_id"], { hash: string, asset_id: string, media_type: string, name: string, thread_id: string, message_id: string }),
} as const;

/** Canonical JSON Schema draft-07 export for the broadcast event union. */
export const AGENT_EVENT_JSON_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://github.com/Comfy-Org/comfy-multi-player/src/event-schema.ts",
  title: "Comfy in-app agent broadcast events",
  oneOf: Object.keys(defs).map((name) => ({ $ref: `#/$defs/${name}` })),
  $defs: defs,
} as const;
