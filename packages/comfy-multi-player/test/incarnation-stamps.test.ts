import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  LEGACY_NODE_INCARNATION,
  NODE_INCARNATION_KEY,
  applyOps,
  mint,
  migrate,
  project,
  readStamps,
  type Op,
  type WorkflowJSON,
  type WorkflowNode,
} from "../src/index.js";
import { loadCatalog } from "./helpers.js";
import { rejectedOutcome } from "./apply-result-helpers.js";

const catalog = loadCatalog();
const id = (tag: string) => (tag + "0".repeat(32)).slice(0, 32);

function base(): WorkflowJSON {
  return {
    nodes: [{ id: 1, type: "CLIPTextEncode", pos: [0, 0], inputs: [], outputs: [], widgets_values: ["life-1"] }],
    links: [],
    last_node_id: 1,
    last_link_id: 0,
  };
}

function envelope(tag: string, actor: string, version: number) {
  return { op_id: id(tag), actor, base_version: version, stamp: [version, actor] as [number, string] };
}

function setWidget(tag: string, value: string, version: number, incarnation: string): Op {
  return {
    op: "set_widget",
    ...envelope(tag, `human:${tag}`, version),
    node_id: 1,
    widget: "text",
    value,
    node_incarnation: incarnation,
  };
}

function remove(): Op {
  return { op: "delete_node", ...envelope("delete", "agent:a", 10), node_id: 1, removed_links: [] };
}

function readd(): Op {
  return {
    op: "add_node",
    ...envelope("readd", "agent:a", 20),
    node_incarnation: id("readd"),
    node_id: 1,
    class_type: "CLIPTextEncode",
    pos: [0, 0],
    node: { ...base().nodes[0], widgets_values: ["life-2"] } as WorkflowNode,
  };
}

function fork(): Y.Doc {
  const source = mint(base(), catalog);
  const doc = new Y.Doc();
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(source));
  source.destroy();
  return doc;
}

describe("incarnation-namespaced widget stamps (DQ-11)", () => {
  it("converges when a life-1 write arrives before or after delete/re-add", () => {
    const replacement = readd();
    const stale = setWidget("stale", "stale", 100, LEGACY_NODE_INCARNATION);
    const fresh = setWidget("fresh", "fresh", 30, replacement.op_id);
    const first = fork();
    const second = fork();

    expect(rejectedOutcome(applyOps(first, [stale, remove(), replacement, fresh], catalog))).toBeUndefined();
    expect(rejectedOutcome(applyOps(second, [remove(), stale, replacement, fresh], catalog))).toBeUndefined();
    expect(project(first, catalog)).toEqual(project(second, catalog));
    expect(project(first, catalog).nodes[0]?.widgets_values).toEqual(["fresh"]);
    expect(readStamps(first)[JSON.stringify(["widget", "1", replacement.op_id, "text"])])
      .toEqual([30, "human:fresh", fresh.op_id]);
    expect(readStamps(first)[JSON.stringify(["widget", "1", LEGACY_NODE_INCARNATION, "text"])])
      .toBeUndefined();
  });

  it("migrates v1 node lifetimes and widget stamp keys to legacy life 0", () => {
    const doc = mint(base(), catalog);
    const node = doc.getMap<Y.Map<unknown>>("nodes").get("1")!;
    node.delete(NODE_INCARNATION_KEY);
    const stamps = doc.getMap<unknown>("__stamps");
    const oldKey = JSON.stringify(["widget", "1", "text"]);
    stamps.set(oldKey, [7, "human:a", id("old")]);
    doc.getMap("meta").set("schema_version", 1);

    migrate(doc, 1);

    expect(doc.getMap("meta").get("schema_version")).toBe(2);
    expect(node.get(NODE_INCARNATION_KEY)).toBe(LEGACY_NODE_INCARNATION);
    expect(stamps.get(JSON.stringify(["widget", "1", LEGACY_NODE_INCARNATION, "text"]))).toEqual([
      7,
      "human:a",
      id("old"),
    ]);
    expect(stamps.has(oldKey)).toBe(false);
  });

  it("normalizes numeric widget-stamp node ids and retains the LWW winner", () => {
    const doc = mint(base(), catalog);
    const stamps = doc.getMap<unknown>("__stamps");
    const numericKey = JSON.stringify(["widget", 1, "text"]);
    const stringKey = JSON.stringify(["widget", "1", "text"]);
    const migratedKey = JSON.stringify(["widget", "1", LEGACY_NODE_INCARNATION, "text"]);
    stamps.set(numericKey, [8, "human:b", id("winner")]);
    stamps.set(stringKey, [7, "human:a", id("loser")]);
    doc.getMap("meta").set("schema_version", 1);

    migrate(doc, 1);

    expect(stamps.get(migratedKey)).toEqual([8, "human:b", id("winner")]);
    expect(stamps.has(numericKey)).toBe(false);
    expect(stamps.has(stringKey)).toBe(false);
  });
});
