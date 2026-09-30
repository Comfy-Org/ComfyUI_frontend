import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, mint, readLinkState, type WorkflowJSON } from "../src/index.js";
import { initDoc, linkStateMap } from "../src/doc.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();

function workflow(): WorkflowJSON {
  return {
    nodes: [
      { id: 1, type: "LoadImage", inputs: [], outputs: [{ name: "IMAGE", type: "IMAGE", links: [10, 11, 12] }], widgets_values: [] },
      { id: 2, type: "PreviewImage", inputs: [{ name: "images", type: "IMAGE", link: 10 }], outputs: [], widgets_values: [] },
      { id: 3, type: "Stored image subgraph", inputs: [{ name: "nested.dynamic.image", type: "IMAGE", link: 11, widget: { name: "image" } }], outputs: [], widgets_values: [] },
      { id: 4, type: "PreviewImage", inputs: [{ name: "images.image7", type: "IMAGE", link: 12, grow_id: 12, widget: { name: "images" }, custom: { retained: true } }], outputs: [], widgets_values: [] },
    ],
    links: [
      [10, 1, 0, 2, 0, "IMAGE"],
      [11, 1, 0, 3, 0, "IMAGE"],
      [12, 1, 0, 4, 0, "IMAGE"],
    ],
    definitions: {
      subgraphs: [{ id: "definition-id", name: "Stored image subgraph", inputs: [{ name: "nested.dynamic.image", type: "IMAGE" }], nodes: [], links: [] }],
    },
  };
}

describe("schema v5 retains first-class imported link state", () => {
  it("stores complete concrete, full-name promoted, and grown descriptors", () => {
    const doc = mint(workflow(), catalog);
    expect(SCHEMA_VERSION).toBe(5);
    expect(readLinkState(doc)).toEqual({
      "10": { version: 1, authority: "imported", tuple: [10, 1, 0, 2, 0, "IMAGE"], destination: { kind: "concrete", to_slot: 0, slot: { name: "images", type: "IMAGE", link: 10 } } },
      "11": { version: 1, authority: "imported", tuple: [11, 1, 0, 3, 0, "IMAGE"], destination: { kind: "promoted", to_slot: 0, name: "nested.dynamic.image", slot: { name: "nested.dynamic.image", type: "IMAGE", link: 11, widget: { name: "image" } } } },
      "12": { version: 1, authority: "imported", tuple: [12, 1, 0, 4, 0, "IMAGE"], destination: { kind: "autogrow", to_slot: 0, slot: { name: "images.image7", type: "IMAGE", link: 12, grow_id: 12, widget: { name: "images" }, custom: { retained: true } } } },
    });
  });

  it("rejects malformed tuples but preserves supported dangling imports without inventing descriptors", () => {
    const malformed = workflow();
    malformed.links[0] = [10, 1, 0, 2, 0];
    expect(() => mint(malformed, catalog)).toThrow(/link tuple.*six fields/i);

    const missing = workflow();
    missing.nodes = missing.nodes.filter((node) => node.id !== 2);
    const doc = mint(missing, catalog);
    expect(readLinkState(doc)["10"]).toBeUndefined();
    expect((doc.getMap("links").get("10") as unknown[])[0]).toBe(10);
  });

  it("removes a coherent descriptor when a later normalized duplicate link id is dangling", () => {
    const value = workflow();
    value.links.splice(1, 0, ["10", 1, 0, 999, 0, "IMAGE"]);

    const doc = mint(value, catalog);

    expect(doc.getMap("links").get("10")).toEqual(["10", 1, 0, 999, 0, "IMAGE"]);
    expect(readLinkState(doc)["10"]).toBeUndefined();
  });

  it("builds descriptors against the last node retained for a normalized duplicate node id", () => {
    const value = workflow();
    value.nodes.splice(1, 0, { id: "1", type: "LoadImage", inputs: [], outputs: [], widgets_values: [] });

    const doc = mint(value, catalog);

    expect(doc.getMap("nodes").get("1")).toBeDefined();
    expect(readLinkState(doc)["10"]).toBeUndefined();
  });

  it.each([
    ["invalid tuple id", (value: WorkflowJSON) => { value.links[0] = [{ bad: true }, 1, 0, 2, 0, "IMAGE"]; }, /link tuple id must be/],
    ["invalid endpoint id", (value: WorkflowJSON) => { value.links[0] = [10, null, 0, 2, 0, "IMAGE"]; }, /source node id must be/],
  ])("rejects %s", (_label, corrupt, error) => {
    const value = workflow();
    corrupt(value);
    expect(() => mint(value, catalog)).toThrow(error);
  });

  it.each([
    ["missing source slot", (value: WorkflowJSON) => { value.nodes[0]!.outputs = []; }],
    ["missing destination slot", (value: WorkflowJSON) => { value.nodes[1]!.inputs = []; }],
    ["source reference mismatch", (value: WorkflowJSON) => { (value.nodes[0]!.outputs![0] as { links: unknown[] }).links = [11, 12]; }],
    ["destination reference mismatch", (value: WorkflowJSON) => { (value.nodes[1]!.inputs![0] as { link: unknown }).link = 99; }],
  ])("preserves incomplete import with %s and omits its descriptor", (_label, makeIncomplete) => {
    const value = workflow();
    makeIncomplete(value);
    const doc = mint(value, catalog);
    expect(doc.getMap("links").has("10")).toBe(true);
    expect(readLinkState(doc)["10"]).toBeUndefined();
  });

  it("survives snapshot round trips and its read does not create a root", () => {
    const encoded = Y.encodeStateAsUpdate(mint(workflow(), catalog));
    const fork = new Y.Doc();
    Y.applyUpdate(fork, encoded);
    expect(readLinkState(fork)).toEqual(readLinkState(mint(workflow(), catalog)));
    expect(fork.share.has("__link_state")).toBe(true);

    const empty = new Y.Doc();
    expect(readLinkState(empty)).toEqual({});
    expect([...empty.share.keys()]).toEqual([]);
  });

  it("fails closed on an unsupported persisted descriptor", () => {
    const doc = mint(workflow(), catalog);
    linkStateMap(doc).set("10", { version: 2, authority: "imported", tuple: [10, 1, 0, 2, 0, "IMAGE"], destination: { kind: "concrete" } });
    expect(() => readLinkState(doc)).toThrow(/unsupported or malformed descriptor/);
    linkStateMap(doc).set("10", { version: 1, authority: "imported", tuple: [10, 1, 0, 2, 0, "IMAGE"], destination: { kind: "future" } });
    expect(() => readLinkState(doc)).toThrow(/unsupported or malformed descriptor/);
  });

  it.each([
    ["map-key/tuple-id mismatch", "10", { version: 1, authority: "imported", tuple: [99, 1, 0, 2, 0, "IMAGE"], destination: { kind: "concrete", to_slot: 0, slot: {} } }],
    ["descriptor version", "10", { version: 2, authority: "imported", tuple: [10, 1, 0, 2, 0, "IMAGE"], destination: { kind: "concrete", to_slot: 0, slot: {} } }],
    ["destination kind", "10", { version: 1, authority: "imported", tuple: [10, 1, 0, 2, 0, "IMAGE"], destination: { kind: "future", to_slot: 0, slot: {} } }],
    ["array destination", "10", { version: 1, authority: "imported", tuple: [10, 1, 0, 2, 0, "IMAGE"], destination: [] }],
    ["destination tuple slot mismatch", "10", { version: 1, authority: "imported", tuple: [10, 1, 0, 2, 0, "IMAGE"], destination: { kind: "concrete", to_slot: 1, slot: {} } }],
    ["NaN operation stamp", "10", { version: 1, authority: { kind: "operation", stamp: [NaN, "agent:test", "0".repeat(32)] }, tuple: [10, 1, 0, 2, 0, "IMAGE"], destination: { kind: "concrete", to_slot: 0, slot: { link: 10 } } }],
    ["negative operation stamp", "10", { version: 1, authority: { kind: "operation", stamp: [-1, "agent:test", "0".repeat(32)] }, tuple: [10, 1, 0, 2, 0, "IMAGE"], destination: { kind: "concrete", to_slot: 0, slot: { link: 10 } } }],
    ["fractional operation stamp", "10", { version: 1, authority: { kind: "operation", stamp: [1.5, "agent:test", "0".repeat(32)] }, tuple: [10, 1, 0, 2, 0, "IMAGE"], destination: { kind: "concrete", to_slot: 0, slot: { link: 10 } } }],
    ["non-string operation actor", "10", { version: 1, authority: { kind: "operation", stamp: [1, 12, "0".repeat(32)] }, tuple: [10, 1, 0, 2, 0, "IMAGE"], destination: { kind: "concrete", to_slot: 0, slot: { link: 10 } } }],
    ["empty operation id", "10", { version: 1, authority: { kind: "operation", stamp: [1, "agent:test", ""] }, tuple: [10, 1, 0, 2, 0, "IMAGE"], destination: { kind: "concrete", to_slot: 0, slot: { link: 10 } } }],
    ["empty autogrow request", "10", { version: 1, authority: { kind: "operation", stamp: [1, "agent:test", "0".repeat(32)] }, tuple: [10, 1, 0, 2, 0, "IMAGE"], destination: { kind: "autogrow", to_slot: 0, slot: { link: 10 }, request: {} } }],
  ])("rejects malformed persisted %s", (_label, key, descriptor) => {
    const doc = mint(workflow(), catalog);
    linkStateMap(doc).set(key, descriptor);
    expect(() => readLinkState(doc)).toThrow(/unsupported or malformed descriptor/);
  });

  it("initDoc creates the first-class root", () => {
    const doc = new Y.Doc();
    initDoc(doc);
    expect(linkStateMap(doc).size).toBe(0);
    expect(doc.share.has("__link_state")).toBe(true);
  });
});
