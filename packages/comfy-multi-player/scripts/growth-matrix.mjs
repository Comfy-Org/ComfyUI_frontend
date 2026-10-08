/**
 * Growth-matrix harness: isolates WHICH root grows under WHICH op shape.
 *
 * Risk 3 (unbounded doc growth) needs a per-root byte breakdown, not one
 * total: the `__applied` digest ledger grows once per op regardless of
 * target, `__stamps` grows once per DISTINCT target, and Yjs tombstones
 * (deleted items / GC structs) grow with every overwrite or delete. A single
 * `encodeStateAsUpdate` number cannot tell those apart, so this module
 * measures four figures per checkpoint:
 *
 *   total     = encodeStateAsUpdate(doc).byteLength          (live + history)
 *   liveAll   = same content re-encoded into a FRESH doc     (live only)
 *   live[root]= one fresh doc per root                       (live, per root)
 *   history   = total - liveAll                              (tombstones etc.)
 *
 * The re-encode is faithful: root Y.Maps are copied entry-by-entry with
 * `AbstractType.clone()` so nested Y types stay Y types (a nested Y.Map and a
 * plain object encode differently). For the single-client docs these
 * workloads build, `history` is exactly the delete-set plus GC'd struct
 * shells, i.e. the tombstone contribution named in the risk-3 audit.
 *
 * The CMP surface is dependency-injected (`{ Y, mint, applyOps }`) so
 * `scripts/bench-growth.mjs` can run it against `dist/` while
 * `test/growth-matrix.test.ts` runs the identical code against `src/` (the
 * first CI job runs tests WITHOUT a build).
 */

const WIDGET_ORDER = [
  "seed",
  "control_after_generate",
  "steps",
  "cfg",
  "sampler_name",
  "scheduler",
  "denoise",
];

export const CATALOG = {
  catalog_version: "growth-matrix",
  types: { KSampler: { widget_order: WIDGET_ORDER } },
};

export function ksamplerNode(id) {
  return {
    id,
    type: "KSampler",
    pos: [id * 30, id * 17],
    size: [315, 262],
    order: id,
    mode: 0,
    flags: { collapsed: false, pinned: false },
    inputs: [
      { name: "model", type: "MODEL", link: null },
      { name: "positive", type: "CONDITIONING", link: null },
      { name: "negative", type: "CONDITIONING", link: null },
    ],
    outputs: [{ name: "LATENT", type: "LATENT", links: null, slot_index: 0 }],
    widgets_values: [12345 + id, "randomize", 20, 8, "euler", "normal", 1],
    properties: { "Node name for S&R": "KSampler" },
  };
}

export function workflow(n) {
  const nodes = [];
  const links = [];
  for (let i = 1; i <= n; i++) {
    nodes.push(ksamplerNode(i));
    if (i > 1) links.push([i, i - 1, 0, i, 0, "LATENT"]);
  }
  return {
    id: "growth",
    last_node_id: n,
    last_link_id: n,
    nodes,
    links,
    groups: [],
    extra: {},
  };
}

/** Deterministic, collision-free 32-lowercase-hex op id (fixed-width hex counter). */
export function opId(i) {
  return `a${i.toString(16).padStart(31, "0")}`;
}

function envelope(i, actor, body) {
  return {
    op_id: opId(i),
    actor,
    base_version: i + 1,
    stamp: [i + 1, actor],
    ...body,
  };
}

// Mirrors src/limits.ts MAX_OPS_PER_BATCH (the bench runs against dist/, so the
// harness cannot import src/); test/growth-matrix.test.ts pins the two equal.
export const MAX_OPS_PER_BATCH = 1024;

// ---------------------------------------------------------------------------
// Workloads: each returns { nodes, ops(count) } where ops yields the i-th op.
// `checkpointEvery` lets add/delete land its checkpoints after the delete.
// ---------------------------------------------------------------------------

const WORKLOADS = {
  /** Same (node, widget) rewritten every op: __applied grows, __stamps live stays flat, history grows. */
  single_target_churn: {
    nodes: 4,
    checkpointEvery: 1,
    op: (i) =>
      envelope(i, "actor-a", {
        op: "set_widget",
        node_id: 1,
        widget: "steps",
        value: 20 + i,
      }),
  },
  /** Each op hits a fresh (node, widget): __stamps live grows once per target. */
  distinct_target_churn: {
    nodes: (opCount) => Math.ceil(opCount / WIDGET_ORDER.length) + 1,
    checkpointEvery: 1,
    op: (i) =>
      envelope(i, "actor-a", {
        op: "set_widget",
        node_id: Math.floor(i / WIDGET_ORDER.length) + 1,
        widget: WIDGET_ORDER[i % WIDGET_ORDER.length],
        value:
          i % WIDGET_ORDER.length === 0
            ? 1000 + i
            : i % 2 === 0
              ? 3 + i
              : `v${i}`,
      }),
  },
  /** add_node then delete_node on a fresh id: nodes live returns to baseline, tombstones accumulate. */
  add_delete_churn: {
    nodes: 4,
    checkpointEvery: 2,
    op: (i) => {
      const nodeId = 1000 + Math.floor(i / 2);
      if (i % 2 === 0) {
        return envelope(i, "actor-a", {
          op: "add_node",
          node_id: nodeId,
          class_type: "KSampler",
          pos: [0, 0],
          node: ksamplerNode(nodeId),
        });
      }
      return envelope(i, "actor-a", {
        op: "delete_node",
        node_id: nodeId,
        removed_links: [],
      });
    },
  },
  /** No ops: what mint() itself costs per node at size N (baseline for the other rows). */
  large_workflow_baseline: {
    nodes: (opCount) => opCount,
    checkpointEvery: 1,
    op: null,
  },
};

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

function cloneValue(Y, v) {
  return v instanceof Y.AbstractType ? v.clone() : v;
}

function copyRoot(Y, src, dst) {
  if (src instanceof Y.Map) {
    for (const [k, v] of src.entries()) dst.set(k, cloneValue(Y, v));
  } else if (src instanceof Y.Array) {
    dst.push(src.toArray().map((v) => cloneValue(Y, v)));
  } else {
    throw new TypeError(
      `growth-matrix: unsupported root type ${src?.constructor?.name}`,
    );
  }
}

function freshRoot(Y, fresh, name, src) {
  if (src instanceof Y.Map) return fresh.getMap(name);
  if (src instanceof Y.Array) return fresh.getArray(name);
  throw new TypeError(
    `growth-matrix: unsupported root type ${src?.constructor?.name}`,
  );
}

/** Re-encode a doc's live content (all roots, or one) into a fresh doc; return the byte length. */
function liveBytes(Y, doc, onlyRoot) {
  const fresh = new Y.Doc();
  // The v1 update encoding writes the origin's clientID as a varuint (1-5
  // bytes) on every item, so two docs with different random clientIDs encode
  // identical content to different lengths. Re-use the source clientID so
  // `total - liveAll` isolates tombstones instead of clientID width noise.
  // (Cross-doc comparisons, e.g. two separate mints, still carry that noise;
  // callers compare slopes within a doc or use loose tolerances.)
  fresh.clientID = doc.clientID;
  fresh.transact(() => {
    for (const [name, src] of doc.share) {
      if (onlyRoot !== undefined && name !== onlyRoot) continue;
      copyRoot(Y, src, freshRoot(Y, fresh, name, src));
    }
  });
  const bytes = Y.encodeStateAsUpdate(fresh).byteLength;
  fresh.destroy();
  return bytes;
}

function measure(Y, doc, ops) {
  const total = Y.encodeStateAsUpdate(doc).byteLength;
  const liveAll = liveBytes(Y, doc);
  const live = {};
  for (const name of doc.share.keys()) live[name] = liveBytes(Y, doc, name);
  return { ops, total, liveAll, history: total - liveAll, live };
}

function slope(first, last, ops) {
  return ops === 0 ? 0 : (last - first) / ops;
}

/**
 * Run one workload for `opCount` ops with `checkpoints` evenly spaced samples.
 * Returns { name, nodes, opCount, samples[], slopes } where slopes are
 * bytes-per-op from first to last sample (per root, total, liveAll, history).
 */
export function runWorkload(
  cmp,
  name,
  { opCount = 200, checkpoints = 5 } = {},
) {
  const { Y, mint, applyOps } = cmp;
  const w = WORKLOADS[name];
  if (!w) throw new Error(`growth-matrix: unknown workload '${name}'`);
  if (w.op !== null && opCount % w.checkpointEvery !== 0)
    throw new Error(
      `growth-matrix: ${name} opCount ${opCount} must be a multiple of ${w.checkpointEvery} (a trailing partial add/delete pair would leave a live node in the last sample)`,
    );
  const nodes = typeof w.nodes === "function" ? w.nodes(opCount) : w.nodes;
  const doc = mint(workflow(nodes), CATALOG, CATALOG.catalog_version);

  const samples = [measure(Y, doc, 0)];
  if (w.op !== null) {
    const every = w.checkpointEvery;
    const stepOps = Math.max(
      every,
      Math.round(opCount / (checkpoints - 1) / every) * every,
    );
    let applied = 0;
    while (applied < opCount) {
      const target = Math.min(opCount, applied + stepOps);
      // applyOps refuses batches above MAX_OPS_PER_BATCH; a checkpoint
      // interval may be wider than that, so feed it in capped batches and
      // sample only once the whole interval has landed.
      for (let start = applied; start < target; start += MAX_OPS_PER_BATCH) {
        const end = Math.min(target, start + MAX_OPS_PER_BATCH);
        const batch = [];
        for (let i = start; i < end; i++) batch.push(w.op(i));
        const result = applyOps(doc, batch, CATALOG);
        // A silently rejected batch would flatten every slope to zero and make
        // the matrix lie; fail loudly instead.
        const bad = result.outcomes.find((o) => o.outcome !== "applied");
        if (bad)
          throw new Error(
            `growth-matrix: ${name} op ${bad.op_id} ${bad.outcome}: ${JSON.stringify(bad.reason)}`,
          );
      }
      applied = target;
      samples.push(measure(Y, doc, applied));
    }
  }
  doc.destroy();

  const first = samples[0];
  const last = samples[samples.length - 1];
  const denom = w.op === null ? nodes : last.ops;
  const slopes = {
    total: slope(first.total, last.total, denom),
    liveAll: slope(first.liveAll, last.liveAll, denom),
    history: slope(first.history, last.history, denom),
    live: {},
  };
  for (const root of Object.keys(last.live))
    slopes.live[root] = slope(first.live[root] ?? 0, last.live[root], denom);
  if (w.op === null) {
    // Baseline has no ops; report per-node cost of mint at size N instead.
    slopes.total = last.total / nodes;
    slopes.liveAll = last.liveAll / nodes;
    slopes.history = last.history / nodes;
    for (const root of Object.keys(last.live))
      slopes.live[root] = last.live[root] / nodes;
  }
  return {
    name,
    nodes,
    opCount: w.op === null ? 0 : last.ops,
    unit: w.op === null ? "node" : "op",
    samples,
    slopes,
  };
}

export function runGrowthMatrix(cmp, opts = {}) {
  const names = opts.workloads ?? Object.keys(WORKLOADS);
  const results = {};
  for (const name of names) results[name] = runWorkload(cmp, name, opts);
  return results;
}

/** Render the matrix as a fixed-width table (used by the bench script and the risk-3 report). */
export function formatMatrix(results) {
  const roots = new Set();
  for (const r of Object.values(results))
    for (const k of Object.keys(r.slopes.live)) roots.add(k);
  const cols = [
    "total",
    "liveAll",
    "history",
    ...[...roots].map((r) => `live:${r}`),
  ];
  const rows = Object.values(results).map((r) => {
    const cells = [
      `${r.name} (${r.opCount} ${r.unit}s, ${r.nodes} nodes) B/${r.unit}`,
      r.slopes.total,
      r.slopes.liveAll,
      r.slopes.history,
      ...[...roots].map((k) => r.slopes.live[k] ?? 0),
    ];
    return cells.map((c) => (typeof c === "number" ? c.toFixed(1) : c));
  });
  const header = ["workload", ...cols];
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length)),
  );
  const line = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join("  ");
  return [
    line(header),
    line(widths.map((w) => "-".repeat(w))),
    ...rows.map(line),
  ].join("\n");
}
