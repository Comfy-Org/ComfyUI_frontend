import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  applyOps,
  codePointCompare,
  compareStampKeys,
  mint,
  project,
  stampKey,
  writeTarget,
  type ConcreteConnectOp,
  type DeleteNodeOp,
  type GrowConnectOp,
  type GrowSpec,
  type WidgetCatalog,
  type WireOp,
  type WorkflowJSON,
} from "../src/index.js";

const catalog: WidgetCatalog = {
  types: {
    Source: { widget_order: [] },
    Sink: {
      widget_order: [],
      autogrow_templates: { images: { names: ["hero", "detail"] } },
    },
  },
};

let sequence = 0;
const envelope = (actor = "actor") => ({
  op_id: String(++sequence).padStart(32, "0"),
  actor,
  base_version: sequence,
  stamp: [sequence, actor] as [number, string],
});

const base = (): WorkflowJSON => ({
  nodes: [
    { id: 1, type: "Source", inputs: [], outputs: [{ name: "out", type: "X", links: [] }] },
    { id: 2, type: "Source", inputs: [], outputs: [{ name: "out", type: "X", links: [] }] },
    { id: 3, type: "Sink", inputs: [{ name: "in", type: "X", link: null }], outputs: [] },
  ],
  links: [],
});

const connect = (
  link_id: number,
  from_node: number,
  extra: Partial<ConcreteConnectOp> = {},
): ConcreteConnectOp => ({
  op: "connect",
  ...envelope(),
  link_id,
  from_node,
  from_slot: 0,
  to_node: 3,
  to_slot: 0,
  link_type: "X",
  ...extra,
});

/**
 * An autogrow `connect`. Separate from {@link connect} since #17 split
 * `ConnectOp` into concrete and grow variants: a grow op has no numeric
 * `to_slot` to override, so the two cannot share one `Partial<>` override bag.
 */
const growConnect = (link_id: number, from_node: number, grow: GrowSpec): GrowConnectOp => ({
  op: "connect",
  ...envelope(),
  link_id,
  from_node,
  from_slot: 0,
  to_node: 3,
  to_slot: null,
  link_type: "X",
  grow,
});

describe("W8 applier edge goldens (KA-4)", () => {
  it("assigns deterministic unique names across repeated autogrow collisions", () => {
    const doc = mint(base(), catalog);
    const grows = [10, 11, 12].map((id) =>
      growConnect(id, 1, { name: "images.hero", type: "X" }),
    );
    expect(applyOps(doc, grows, catalog).outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();

    const sink = project(doc, catalog).nodes.find((node) => node.id === 3)!;
    expect(sink.inputs).toEqual([
      { name: "in", type: "X", link: null },
      { name: "images.hero", type: "X", link: 10, grow_id: 10 },
      { name: "images.detail", type: "X", link: 11, grow_id: 11 },
      { name: "images.detail2", type: "X", link: 12, grow_id: 12 },
    ]);
  });

  it("deleting a node cleans its dependent link references", () => {
    const doc = mint(base(), catalog);
    const link = connect(20, 1);
    const del: DeleteNodeOp = {
      op: "delete_node",
      ...envelope(),
      node_id: 1,
      removed_links: [20],
    };
    expect(applyOps(doc, [link, del], catalog).outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
    expect(project(doc, catalog)).toMatchObject({
      links: [],
      nodes: [
        { id: 2, outputs: [{ links: [] }] },
        { id: 3, inputs: [{ link: null }] },
      ],
    });
  });

  it("does not scrub a concurrently replaced link while deleting the old source", () => {
    const oldLink = connect(30, 1);
    const replacement = connect(31, 2);
    const del: DeleteNodeOp = {
      op: "delete_node",
      ...envelope(),
      node_id: 1,
      removed_links: [30],
    };
    const projections = [
      [oldLink, replacement, del],
      [oldLink, del, replacement],
    ].map((ops) => {
      const doc = mint(base(), catalog);
      expect(applyOps(doc, ops, catalog).outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();

      const beforeRetry = Buffer.from(Y.encodeStateAsUpdate(doc));
      expect(
        applyOps(doc, [replacement], catalog).outcomes
          .filter((outcome) => outcome.outcome === "no-op")
          .map((outcome) => outcome.op_id),
      ).toEqual([replacement.op_id]);
      expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(beforeRetry)).toBe(true);
      return project(doc, catalog);
    });

    expect(projections[1]).toEqual(projections[0]);
    const out = projections[0]!;
    expect(out.links).toEqual([[31, 2, 0, 3, 0, "X"]]);
    expect((out.nodes.find((node) => node.id === 2)!.outputs as Array<{ links: unknown[] }>)[0]!.links)
      .toEqual([31]);
    expect((out.nodes.find((node) => node.id === 3)!.inputs as Array<{ link: unknown }>)[0]!.link)
      .toBe(31);
  });

  it("leaves the document byte-identical and aborts the remainder after a rejection", () => {
    const doc = mint(base(), catalog);
    // Byte identity, not projection equality (KA-4). `project()` renders neither
    // `__stamps` nor `__applied`, so a rejection that claims the LWW register
    // before throwing is invisible to a projection snapshot — the whole point of
    // `.agents/checks/test-quality.md` §2. `input_slot_missing` is validated
    // ahead of the first write, so the stronger assertion is the true one here.
    const beforeBytes = Buffer.from(Y.encodeStateAsUpdate(doc));
    const before = project(doc, catalog);
    const malformed = connect(50, 1, { to_slot: 99 });
    const trailing = connect(51, 2);

    const result = applyOps(doc, [malformed, trailing], catalog);
    expect(result.outcomes.findIndex((outcome) => outcome.outcome === "rejected")).toBe(0);
    expect(result.outcomes.find((outcome) => outcome.outcome === "rejected")?.reason.code).toBe("input_slot_missing");
    expect(result.outcomes.filter((outcome) => outcome.outcome === "applied")).toEqual([]);
    expect(
      Buffer.from(Y.encodeStateAsUpdate(doc)).equals(beforeBytes),
      "encodeStateAsUpdate must be byte-identical",
    ).toBe(true);
    expect(project(doc, catalog)).toEqual(before);
    expect(project(doc, catalog).links).not.toContainEqual([51, 2, 0, 3, 0, "X"]);
  });
});

describe("W8 stamp edge goldens (KA-2, KA-4, FC-7)", () => {
  it("steps astral Unicode by code point in both operands", () => {
    expect(codePointCompare("😀a", "😀b")).toBe(-1);
    expect(codePointCompare("😀b", "😀a")).toBe(1);
    expect(codePointCompare("😀", "\uE000")).toBe(1);
    expect(compareStampKeys([1, "😀a", "x"], [1, "😀b", "x"])).toBe(-1);
  });

  it("orders strict prefixes in both directions", () => {
    expect(codePointCompare("actor", "actor😀")).toBe(-1);
    expect(codePointCompare("actor😀", "actor")).toBe(1);
  });

  it("pins stamp and write-target fallback variants", () => {
    const unstamped = {
      op: "set_widget",
      op_id: "a".repeat(32),
      base_version: 7,
      actor: "fallback",
      node_id: 4,
      widget: "value",
      value: 1,
    } as unknown as WireOp;
    expect(stampKey(unstamped)).toEqual([7, "fallback", "a".repeat(32)]);
    expect(writeTarget(unstamped)).toEqual(["widget", "4", "0", "value"]);
    // Both shapes below are ones the `SetWidgetOp` union no longer permits
    // (#17): an EMPTY path with an `inner_widget`, and a path whose segments
    // are not all strings. `writeTarget` is public and hosts feed it wire
    // data, so its tolerant handling of them is pinned unchanged — the cast is
    // what marks them as arriving from outside this repo's types.
    expect(writeTarget({ ...unstamped, path: [], inner_widget: "inner" } as unknown as WireOp)).toEqual([
      "widget", "4", "0", "value",
    ]);
    expect(
      writeTarget({ ...unstamped, path: [4, "5"], inner_widget: "inner" } as unknown as WireOp),
    ).toEqual(["widget", ["4", "5"], "0", "inner"]);
    expect(writeTarget(connect(40, 1))).toEqual(["input", "3", 0]);
    expect(
      writeTarget(growConnect(41, 1, { name: "images.hero", type: "X" })),
    ).toEqual(["input", "3", "grow", "images"]);
  });
});
