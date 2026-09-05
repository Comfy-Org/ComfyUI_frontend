import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import { linksMap, nodesMap } from "../src/doc.js";
import { mint, type WorkflowJSON } from "../src/index.js";
import { checkGraphInvariants } from "./graph-invariant-oracle.js";

const catalog = { types: {} };
const workflow: WorkflowJSON = {
  nodes: [
    { id: 1, type: "Source", inputs: [], outputs: [{ name: "OUT", type: "X", links: [10] }], widgets_values: [] },
    { id: 2, type: "Destination", inputs: [{ name: "IN", type: "X", link: 10 }], outputs: [], widgets_values: [] },
  ],
  links: [[10, 1, 0, 2, 0, "X"]],
};

function freshDoc(): Y.Doc {
  return mint(workflow, catalog);
}

describe("checkGraphInvariants test oracle", () => {
  it("accepts a graph satisfying I1 through I5 without changing the doc", () => {
    const doc = freshDoc();
    const before = Y.encodeStateAsUpdate(doc);

    expect(checkGraphInvariants(doc)).toEqual([]);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
  });

  it("reports unresolved input and output references", () => {
    const doc = freshDoc();
    const source = nodesMap(doc).get("1")!;
    const destination = nodesMap(doc).get("2")!;
    const outputLinks = (source.get("outputs") as Y.Array<Y.Map<unknown>>).get(0)!.get("links") as Y.Array<unknown>;
    const input = (destination.get("inputs") as Y.Array<Y.Map<unknown>>).get(0)!;
    outputLinks.push([99]);
    input.set("link", 98);

    expect(checkGraphInvariants(doc).map((item) => item.invariant)).toEqual(["I1", "I2", "I4"]);
  });

  it("reports missing tuple endpoints", () => {
    const doc = freshDoc();
    linksMap(doc).set("11", [11, 404, 0, 405, 0, "X"]);

    expect(checkGraphInvariants(doc).filter((item) => item.invariant === "I3")).toHaveLength(2);
  });

  it("reports links-to-slots disagreement", () => {
    const doc = freshDoc();
    const source = nodesMap(doc).get("1")!;
    const destination = nodesMap(doc).get("2")!;
    const outputLinks = (source.get("outputs") as Y.Array<Y.Map<unknown>>).get(0)!.get("links") as Y.Array<unknown>;
    const input = (destination.get("inputs") as Y.Array<Y.Map<unknown>>).get(0)!;
    outputLinks.delete(0);
    input.set("link", null);

    expect(checkGraphInvariants(doc).filter((item) => item.invariant === "I4")).toHaveLength(2);
  });

  it("reports two tuples claiming one input register", () => {
    const doc = freshDoc();
    linksMap(doc).set("11", [11, 1, 0, 2, 0, "X"]);

    expect(checkGraphInvariants(doc).map((item) => item.invariant)).toContain("I5");
  });
});
