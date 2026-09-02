/**
 * No-mock CRDT POC — drives the REAL doc-host sidecar from cloud main
 * (services/agent/dochost/src/server.ts). The sidecar consumes the published
 * @comfyorg/comfy-multi-player@0.1.0 package; this driver exercises that applier
 * through the sidecar's HTTP contract.
 *
 * Nothing here is stubbed: mint, apply, and project all execute inside the real
 * server over loopback HTTP; the follower is a real Y.Doc integrating only the
 * host's incremental Yjs deltas (raw-struct fan-out), never the whole doc.
 *
 * Proves, end to end through the deployed server contract:
 *   1. concurrent human set_widget || agent add_node+connect both land;
 *   2. a follower that applied ONLY the host deltas converges to the host
 *      projection (projection-equality, per schema §2.5 — state bytes differ by
 *      random clientID per fold, so equality is on the projection);
 *   3. redelivering a delta is a no-op (idempotency);
 *   4. deltas integrate order-independently at the follower.
 *
 * Run:  node examples/dochost-poc/dochost-driver.mjs   (dochost must be on :8095)
 */
import { readFileSync } from "node:fs";

const HOST = process.env.DOC_HOST || "http://127.0.0.1:8095";
const CMP = process.env.CMP_PIN || new URL("../../", import.meta.url).pathname; // repo root

const catalog = JSON.parse(readFileSync(`${CMP}/fixtures/catalog.json`, "utf8"));
// Real base workflow: the team-spike edit-heavy session's base graph.
const session = readFileSync(`${CMP}/fixtures/session-edit-heavy.session.jsonl`, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const base = session[0].base_workflow;

const KSAMPLER = base.nodes.find((n) => n.type === "KSampler");
const CLIP = base.nodes.find((n) => n.type === "CLIPTextEncode");

let idc = 0;
const opId = () => (Date.now().toString(16) + (idc++).toString(16).padStart(4, "0")).padEnd(32, "0").slice(0, 32);
const rid = () => Math.floor(Math.random() * (2 ** 53 - 2 ** 40)) + 2 ** 40;

async function post(path, body) {
  const r = await fetch(HOST + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${path} ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let pass = 0,
  fail = 0;
const check = (name, cond, extra = "") => {
  (cond ? (pass++, console.log(`  PASS  ${name}`)) : (fail++, console.log(`  FAIL  ${name} ${extra}`)));
};

console.log("== no-mock CRDT POC through the real doc-host sidecar ==");
console.log(`host=${HOST}  cmp-pin=${CMP}`);
const health = await (await fetch(HOST + "/health")).json();
console.log(`dochost /health -> ${JSON.stringify(health)}\n`);

// 1. MINT the bootstrap snapshot every replica forks from.
const { snapshot_b64 } = await post("/mint", { workflow: base, catalog });
console.log(`minted snapshot (${Buffer.from(snapshot_b64, "base64").length} bytes)\n`);

// 2. Two CONCURRENT edits minted against the same base_version=1:
//    human changes the KSampler seed; agent adds a CLIPTextEncode and wires it.
const humanOp = {
  op: "set_widget",
  op_id: opId(),
  actor: "human:jo",
  base_version: 1,
  stamp: [1, "human:jo"],
  node_id: KSAMPLER.id,
  widget: "seed",
  value: 424242,
  old: KSAMPLER.widgets_values?.[0],
};

const newNodeId = rid();
const newLinkId = rid();
const agentAdd = {
  op: "add_node",
  op_id: opId(),
  actor: "agent:comfy",
  base_version: 1,
  stamp: [1, "agent:comfy"],
  node_id: newNodeId,
  class_type: "CLIPTextEncode",
  pos: [360, 320],
  node: {
    id: newNodeId,
    type: "CLIPTextEncode",
    pos: [360, 320],
    size: [240, 86],
    flags: {},
    order: 0,
    mode: 0,
    inputs: [{ name: "clip", type: "CLIP", link: null }],
    outputs: [{ name: "CONDITIONING", type: "CONDITIONING", links: [] }],
    properties: {},
    widgets_values: ["a second positive prompt, added by the agent"],
  },
};
const agentConnect = {
  op: "connect",
  op_id: opId(),
  actor: "agent:comfy",
  base_version: 1,
  stamp: [1, "agent:comfy"],
  link_id: newLinkId,
  from_node: newNodeId,
  from_slot: 0,
  to_node: KSAMPLER.id,
  to_slot: 1, // positive conditioning
  link_type: "CONDITIONING",
};

// 3. Single-writer host serializes arrival order: human first, then agent.
const r1 = await post("/apply", {
  snapshot_b64,
  updates_b64: [],
  ops: [humanOp],
  actor: "human:jo",
  turn_id: "t1",
  catalog,
});
check("human set_widget applied", eq(r1.apply_result.applied, [humanOp.op_id]), JSON.stringify(r1.apply_result));

const r2 = await post("/apply", {
  snapshot_b64,
  updates_b64: [r1.update_b64],
  ops: [agentAdd, agentConnect],
  actor: "agent:comfy",
  turn_id: "t2",
  catalog,
});
check(
  "agent add_node+connect applied",
  eq(r2.apply_result.applied, [agentAdd.op_id, agentConnect.op_id]),
  JSON.stringify(r2.apply_result),
);

// Host projection after both edits.
const hostProj = r2.projection;
const hostK = hostProj.nodes.find((n) => String(n.id) === String(KSAMPLER.id));
check("host: human seed edit present", hostK && Number(hostK.widgets_values[0]) === 424242, JSON.stringify(hostK?.widgets_values));
check("host: agent node present", !!hostProj.nodes.find((n) => String(n.id) === String(newNodeId)));

// 4. FOLLOWER converges from the host DELTAS only (raw-struct fan-out).
//    /project folds snapshot + the two host updates and projects — this is
//    exactly what a follower Y.Doc integrates via applyUpdate.
const follower = await post("/project", {
  snapshot_b64,
  updates_b64: [r1.update_b64, r2.update_b64],
  catalog,
});
check("follower projection == host projection (convergence)", eq(follower.projection, hostProj));

// 5. IDEMPOTENCY: redelivering update2 changes nothing.
const followerDup = await post("/project", {
  snapshot_b64,
  updates_b64: [r1.update_b64, r2.update_b64, r2.update_b64],
  catalog,
});
check("redelivered delta is a no-op (idempotent)", eq(followerDup.projection, hostProj));

// 6. ORDER-INDEPENDENCE: deltas integrate commutatively at the follower.
const followerRev = await post("/project", {
  snapshot_b64,
  updates_b64: [r2.update_b64, r1.update_b64],
  catalog,
});
check("deltas integrate order-independently", eq(followerRev.projection, hostProj));

console.log(`\n${fail === 0 ? "ALL GREEN" : "FAILURES"}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
