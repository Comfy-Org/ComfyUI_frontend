/**
 * No-mock CRDT POC — drives the REAL doc-host sidecar from cloud main
 * (services/agent/dochost/src/server.ts). run.sh installs the checked-out packed
 * package in a disposable sidecar, verifies its identity, and invokes this
 * driver to compare its HTTP results with the direct local build.
 *
 * Nothing here is stubbed: mint, apply, and project all execute inside the real
 * server over loopback HTTP; the follower is a real Y.Doc integrating only the
 * host's incremental Yjs deltas (raw-struct fan-out), never the whole doc.
 *
 * Checks through the supplied sidecar's HTTP contract (not a deployment):
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
import { fileURLToPath, pathToFileURL } from "node:url";

const HOST = process.env.DOC_HOST || "http://127.0.0.1:8095";
const CMP = process.env.CMP_PIN || fileURLToPath(new URL("../../", import.meta.url)); // repo root

const catalog = JSON.parse(readFileSync(`${CMP}/fixtures/catalog.json`, "utf8"));
// Keep package-dependent imports below `const catalog =`: the launcher copies
// the source prefix to an artificial root as a portability regression probe.
const cmp = await import(pathToFileURL(`${CMP}/dist/index.js`).href);
const Y = await import(pathToFileURL(`${CMP}/node_modules/yjs/dist/yjs.mjs`).href);
// Real base workflow: the team-spike edit-heavy session's base graph.
const session = readFileSync(`${CMP}/fixtures/session-edit-heavy.session.jsonl`, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const base = session[0].base_workflow;

const KSAMPLER = base.nodes.find((n) => n.type === "KSampler");

let idc = 0;
const opId = () => (Date.now().toString(16) + (idc++).toString(16).padStart(4, "0")).padEnd(32, "0").slice(0, 32);
const rid = () => Math.floor(Math.random() * (2 ** 53 - 2 ** 40)) + 2 ** 40;

async function post(path, body) {
  const r = await fetch(HOST + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${path} ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
};
const eq = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const stableOutcomes = (result) => {
  if (!result || !Array.isArray(result.outcomes) || !Number.isInteger(result.ops_seen)) {
    throw new Error(`sidecar returned legacy/invalid ApplyResult: ${JSON.stringify(result)}`);
  }
  return {
    outcomes: result.outcomes.map((item) => ({
      op_id: item.op_id,
      outcome: item.outcome,
      ...(item.outcome === "rejected" ? { code: item.reason?.code } : {}),
    })),
    ops_seen: result.ops_seen,
  };
};

const directApply = (updates_b64, ops) => {
  // KA-10: every direct comparison starts from the one server-minted bootstrap
  // snapshot, then folds only prior HOST deltas. Its update is never sent to
  // the host or followers.
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, Buffer.from(snapshot_b64, "base64"));
    for (const update of updates_b64) Y.applyUpdate(doc, Buffer.from(update, "base64"));
    const apply_result = cmp.applyOps(doc, ops, catalog);
    return { apply_result, projection: cmp.project(doc, catalog) };
  } finally {
    doc.destroy();
  }
};
let pass = 0,
  fail = 0;
const check = (name, cond, extra = "") => {
  (cond ? (pass++, console.log(`  PASS  ${name}`)) : (fail++, console.log(`  FAIL  ${name} ${extra}`)));
};

console.log("== no-mock CRDT POC through the real doc-host sidecar ==");
console.log(`host=${HOST}  cmp-pin=${CMP}`);
const healthResponse = await fetch(HOST + "/health", { signal: AbortSignal.timeout(10_000) });
if (!healthResponse.ok) throw new Error(`sidecar health returned ${healthResponse.status}`);
const health = await healthResponse.json();
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
const d1 = directApply([], [humanOp]);
check("human ApplyResult matches local executable package", eq(stableOutcomes(r1.apply_result), stableOutcomes(d1.apply_result)), JSON.stringify(r1.apply_result));
check("human projection matches local executable package", eq(r1.projection, d1.projection));
check("human set_widget applied", r1.apply_result.outcomes?.[0]?.op_id === humanOp.op_id && r1.apply_result.outcomes[0].outcome === "applied", JSON.stringify(r1.apply_result));

const r2 = await post("/apply", {
  snapshot_b64,
  updates_b64: [r1.update_b64],
  ops: [agentAdd, agentConnect],
  actor: "agent:comfy",
  turn_id: "t2",
  catalog,
});
const d2 = directApply([r1.update_b64], [agentAdd, agentConnect]);
check(
  "agent ApplyResult matches local executable package",
  eq(stableOutcomes(r2.apply_result), stableOutcomes(d2.apply_result)),
  JSON.stringify(r2.apply_result),
);
check("agent projection matches local executable package", eq(r2.projection, d2.projection));
check(
  "agent add_node+connect applied",
  eq(r2.apply_result.outcomes?.map(({ op_id, outcome }) => ({ op_id, outcome })), [
    { op_id: agentAdd.op_id, outcome: "applied" },
    { op_id: agentConnect.op_id, outcome: "applied" },
  ]),
  JSON.stringify(r2.apply_result),
);

// Host projection after both edits.
const hostProj = r2.projection;
const hostK = hostProj.nodes.find((n) => String(n.id) === String(KSAMPLER.id));
check("host: human seed edit present", hostK && Number(hostK.widgets_values[0]) === 424242, JSON.stringify(hostK?.widgets_values));
check("host: agent node present", !!hostProj.nodes.find((n) => String(n.id) === String(newNodeId)));
check("host: agent link present", eq(hostProj.links.find((link) => String(link[0]) === String(newLinkId)),
  [newLinkId, newNodeId, 0, KSAMPLER.id, 1, "CONDITIONING"]));

// A real refusal pins comparison of the stable reason code (never its
// intentionally human/volatile message).
const rejectedOp = { ...humanOp, op_id: opId(), stamp: [2, "human:jo"], widget: "not_a_real_widget" };
const abortedOp = { ...humanOp, op_id: opId(), stamp: [3, "human:jo"], value: 515151 };
const r3 = await post("/apply", {
  snapshot_b64,
  updates_b64: [r1.update_b64, r2.update_b64],
  ops: [rejectedOp, abortedOp],
  actor: "human:jo",
  turn_id: "t3-rejection-probe",
  catalog,
});
const d3 = directApply([r1.update_b64, r2.update_b64], [rejectedOp, abortedOp]);
check(
  "rejected ApplyResult and stable reason code match local executable package",
  eq(stableOutcomes(r3.apply_result), stableOutcomes(d3.apply_result)),
  JSON.stringify(r3.apply_result),
);
check("unknown widget is rejected", r3.apply_result.outcomes?.[0]?.outcome === "rejected"
  && r3.apply_result.outcomes[0].reason?.code === "unknown_widget");
check("valid trailing operation is batch_aborted", r3.apply_result.outcomes?.[1]?.op_id === abortedOp.op_id
  && r3.apply_result.outcomes[1].outcome === "rejected"
  && r3.apply_result.outcomes[1].reason?.code === "batch_aborted");
check("rejected batch projection matches local executable package", eq(r3.projection, d3.projection));
check("rejection leaves graph unchanged", eq(r3.projection, hostProj));

// Reconstruct both documents from the same bootstrap and prior HOST deltas,
// then fold the returned rejection delta into only the after-document. This
// direct comparison never enters either the host or follower update stream.
const rejectionBefore = new Y.Doc();
const rejectionAfter = new Y.Doc();
try {
  for (const doc of [rejectionBefore, rejectionAfter]) {
    Y.applyUpdate(doc, Buffer.from(snapshot_b64, "base64"));
    Y.applyUpdate(doc, Buffer.from(r1.update_b64, "base64"));
    Y.applyUpdate(doc, Buffer.from(r2.update_b64, "base64"));
  }
  Y.applyUpdate(rejectionAfter, Buffer.from(r3.update_b64, "base64"));
  check(
    "rejected batch leaves encoded document state unchanged",
    Buffer.from(Y.encodeStateAsUpdate(rejectionBefore)).equals(Buffer.from(Y.encodeStateAsUpdate(rejectionAfter))),
  );
  check(
    "rejected operation is absent from __applied",
    !rejectionAfter.getMap("__applied").has(rejectedOp.op_id),
  );
  check(
    "batch-aborted trailing operation is absent from __applied",
    !rejectionAfter.getMap("__applied").has(abortedOp.op_id),
  );
} finally {
  rejectionBefore.destroy();
  rejectionAfter.destroy();
}

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
