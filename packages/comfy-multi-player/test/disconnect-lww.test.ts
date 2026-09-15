import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  applyOps,
  mint,
  project,
  type ConcreteConnectOp,
  type DisconnectOp,
  type Op,
  type WorkflowJSON,
  type WorkflowNode,
} from "../src/index.js";
import { canonicalize, loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const HUMAN = "human:u_41ab:tab_2";
const AGENT = "agent:th_8f2c:12";
const SOURCE = 100;
const TARGET = 200;
const SLOT = 0;

function opId(tag: string): string {
  return (tag + "0".repeat(32)).slice(0, 32);
}

function sourceNode(): WorkflowNode {
  return {
    id: SOURCE,
    type: "CLIPTextEncode",
    pos: [20, 20],
    inputs: [{ name: "clip", type: "CLIP", link: null }],
    outputs: [{ name: "CONDITIONING", type: "CONDITIONING", links: [9000] }],
    widgets_values: ["seed"],
  };
}

function targetNode(): WorkflowNode {
  return {
    id: TARGET,
    type: "KSampler",
    pos: [320, 20],
    inputs: [{ name: "positive", type: "CONDITIONING", link: 9000 }],
    outputs: [{ name: "LATENT", type: "LATENT", links: [] }],
    widgets_values: [0, "fixed", 20, 8, "euler", "simple", 1],
  };
}

function wiredWorkflow(): WorkflowJSON {
  return {
    last_node_id: TARGET,
    last_link_id: 9000,
    nodes: [sourceNode(), targetNode()],
    links: [[9000, SOURCE, 0, TARGET, SLOT, "CONDITIONING"]],
    groups: [],
    extra: {},
    version: 0.4,
  };
}

function disconnect(
  tag: string,
  actor: string,
  baseVersion: number,
  linkId: DisconnectOp["link_id"] = 9000,
): DisconnectOp {
  return {
    op: "disconnect",
    op_id: opId(tag),
    actor,
    base_version: baseVersion,
    stamp: [baseVersion, actor],
    link_id: linkId,
    to_node: TARGET,
    to_slot: SLOT,
  };
}

function connect(
  tag: string,
  actor: string,
  baseVersion: number,
  linkId: ConcreteConnectOp["link_id"] = 9001,
): ConcreteConnectOp {
  return {
    op: "connect",
    op_id: opId(tag),
    actor,
    base_version: baseVersion,
    stamp: [baseVersion, actor],
    link_id: linkId,
    from_node: SOURCE,
    from_slot: 0,
    to_node: TARGET,
    to_slot: SLOT,
    link_type: "CONDITIONING",
  };
}

function projected(ops: Op[]): WorkflowJSON {
  const doc = mint(wiredWorkflow(), catalog, "sha");
  const result = applyOps(doc, ops, catalog);
  expect(result.outcomes.every((outcome) => outcome.outcome !== "rejected")).toBe(true);
  return canonicalize(project(doc, catalog));
}

function comparable(wf: WorkflowJSON): string {
  return JSON.stringify(canonicalize(wf));
}

function withSecondTargetSlot(): WorkflowJSON {
  const workflow = wiredWorkflow();
  (workflow.nodes.find((node) => node.id === TARGET)!.inputs as unknown[]).push({
    name: "negative",
    type: "CONDITIONING",
    link: null,
  });
  return workflow;
}

function bytes(doc: Y.Doc): string {
  return Buffer.from(Y.encodeStateAsUpdate(doc)).toString("hex");
}

describe("disconnect", () => {
  it("severs a concrete input link as a standalone semantic operation", () => {
    const wf = projected([disconnect("d1", HUMAN, 1)]);

    expect(wf.links).toEqual([]);
    expect((wf.nodes.find((node) => node.id === TARGET)!.inputs as Array<{ link: unknown }>)[SLOT]!.link).toBeNull();
    expect((wf.nodes.find((node) => node.id === SOURCE)!.outputs as Array<{ links: unknown[] }>)[0]!.links).toEqual([]);
  });

  it("normalizes link identity while scrubbing references outside the claimed slot", () => {
    const workflow = wiredWorkflow();
    (workflow.nodes.find((node) => node.id === TARGET)!.inputs as Array<{ link: unknown }>)[SLOT]!.link = "9000";
    const doc = mint(workflow, catalog, "sha");
    const op = disconnect("d1", HUMAN, 1, "9000");

    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const wf = canonicalize(project(doc, catalog));
    expect(wf.links).toEqual([]);
    expect((wf.nodes.find((node) => node.id === TARGET)!.inputs as Array<{ link: unknown }>)[SLOT]!.link).toBeNull();
    expect((wf.nodes.find((node) => node.id === SOURCE)!.outputs as Array<{ links: unknown[] }>)[0]!.links).toEqual([]);
  });

  it("converges when the named link and claimed input are different registers", () => {
    const run = (ops: Op[]) => {
      const doc = mint(withSecondTargetSlot(), catalog, "sha");
      expect(applyOps(doc, ops, catalog).outcomes.every((outcome) => outcome.outcome !== "rejected")).toBe(true);
      return canonicalize(project(doc, catalog));
    };
    const reconnect = { ...connect("c1", AGENT, 5, 9001), to_slot: 1 };
    const sever = disconnect("d2", HUMAN, 9, 9001);

    expect(comparable(run([sever, reconnect]))).toBe(comparable(run([reconnect, sever])));
    expect(run([reconnect, sever]).links).toEqual([[9001, SOURCE, 0, TARGET, 1, "CONDITIONING"]]);

    const newerReconnect = { ...reconnect, base_version: 9, stamp: [9, AGENT] as [number, string] };
    const olderSever = { ...sever, base_version: 5, stamp: [5, HUMAN] as [number, string] };
    expect(comparable(run([olderSever, newerReconnect]))).toBe(comparable(run([newerReconnect, olderSever])));
    expect(run([olderSever, newerReconnect]).links).toEqual([[9001, SOURCE, 0, TARGET, 1, "CONDITIONING"]]);
  });

  it("is idempotent on retry", () => {
    const doc = mint(wiredWorkflow(), catalog, "sha");
    const op = disconnect("d1", HUMAN, 1);
    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const before = bytes(doc);

    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "no-op" });
    expect(bytes(doc)).toBe(before);
  });

  it("converges with a racing reconnect when disconnect has the higher stamp", () => {
    const a = disconnect("d2", HUMAN, 9);
    const b = connect("c1", AGENT, 5);

    expect(comparable(projected([a, b]))).toBe(comparable(projected([b, a])));
    expect(projected([b, a]).links).toEqual([]);
  });

  it("converges with a racing reconnect when connect has the higher stamp", () => {
    const a = disconnect("d2", HUMAN, 5);
    const b = connect("c1", AGENT, 9);

    expect(comparable(projected([a, b]))).toBe(comparable(projected([b, a])));
    expect(projected([a, b]).links).toEqual([[9001, SOURCE, 0, TARGET, SLOT, "CONDITIONING"]]);
  });
});
