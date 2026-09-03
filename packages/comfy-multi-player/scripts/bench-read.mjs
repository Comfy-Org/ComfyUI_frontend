#!/usr/bin/env node
/**
 * Cost probe for the read-only snapshot surface (src/read.ts).
 *
 * `readGraph()` copies where a raw `nodesMap(doc)` read did not, and the
 * follower calls it on every remote frame — so the copy's cost is a real
 * question, not a footnote. This script answers it against the shipped build,
 * so the number in the PR can be re-measured rather than believed.
 *
 * Three readers over the same document:
 *   (a) LIVE HANDLE   — what the follower does today: walk `nodesMap` and pull
 *                       the four fields it renders straight off the Y.Maps.
 *   (b) readGraph      — the shipped surface: same four fields, deep-cloned and
 *                       deep-frozen.
 *   (c) FULL NODE COPY — the alternative that was rejected: every field of
 *                       every node cloned and frozen, most of them unread.
 *
 * Usage: node scripts/bench-read.mjs [nodeCount] [iterations]
 */

import * as Y from "yjs";
import { readGraph, mint, OPAQUE_WIDGETS_KEY } from "../dist/index.js";
import { nodesMap, linksMap } from "../dist/doc.js";

const NODES = Number(process.argv[2] ?? 200);
const ITERS = Number(process.argv[3] ?? 500);

const catalog = {
  catalog_version: "bench",
  types: {
    KSampler: {
      widget_order: [
        "seed",
        "control_after_generate",
        "steps",
        "cfg",
        "sampler_name",
        "scheduler",
        "denoise",
      ],
    },
  },
};

function workflow(n) {
  const nodes = [];
  const links = [];
  for (let i = 1; i <= n; i++) {
    nodes.push({
      id: i,
      type: "KSampler",
      pos: [i * 30, i * 17],
      size: [315, 262],
      order: i,
      mode: 0,
      flags: { collapsed: false, pinned: false },
      inputs: [
        { name: "model", type: "MODEL", link: null },
        { name: "positive", type: "CONDITIONING", link: null },
        { name: "negative", type: "CONDITIONING", link: null },
      ],
      outputs: [{ name: "LATENT", type: "LATENT", links: null, slot_index: 0 }],
      widgets_values: [12345 + i, "randomize", 20, 8, "euler", "normal", 1],
      properties: { "Node name for S&R": "KSampler" },
    });
    if (i > 1) links.push([i, i - 1, 0, i, 0, "LATENT"]);
  }
  return { id: "bench", last_node_id: n, last_link_id: n, nodes, links, groups: [], extra: {} };
}

const doc = mint(workflow(NODES), catalog, "bench");

/** (a) The pre-#18 follower read: live handles, only the rendered fields. */
function liveHandleRead(d) {
  const nodes = new Map();
  nodesMap(d).forEach((node, id) => {
    if (!(node instanceof Y.Map)) return;
    const type = node.get("type");
    if (typeof type !== "string" || type.length === 0) return;
    const rawPos = node.get("pos");
    const arr = rawPos instanceof Y.Array ? rawPos.toArray() : rawPos;
    const pos = Array.isArray(arr) && arr.length >= 2 ? [Number(arr[0]), Number(arr[1])] : [0, 0];
    let widgets = {};
    const named = node.get("widgets");
    if (named instanceof Y.Map) {
      const out = {};
      named.forEach((v, k) => {
        out[k] = v instanceof Y.Map ? v.toJSON() : v;
      });
      widgets = out;
    } else {
      const opaque = node.get(OPAQUE_WIDGETS_KEY);
      if (Array.isArray(opaque)) {
        const out = {};
        opaque.forEach((v, i) => {
          out[String(i)] = v;
        });
        widgets = out;
      }
    }
    nodes.set(id, { id, type, pos, widgets });
  });
  const links = new Map();
  linksMap(d).forEach((raw, id) => {
    const tuple = raw instanceof Y.Array ? raw.toArray() : raw;
    if (!Array.isArray(tuple) || tuple.length < 5) return;
    links.set(id, { id, originId: tuple[1], originSlot: Number(tuple[2]) || 0, targetId: tuple[3], targetSlot: Number(tuple[4]) || 0 });
  });
  return { nodes, links };
}

/** (b) The shipped surface, plus the same follower-side derivation. */
function readGraphThenDerive(d) {
  const snap = readGraph(d);
  const nodes = new Map();
  for (const [id, node] of Object.entries(snap.nodes)) {
    const type = node.type;
    if (typeof type !== "string" || type.length === 0) continue;
    const arr = node.pos;
    const pos = Array.isArray(arr) && arr.length >= 2 ? [Number(arr[0]), Number(arr[1])] : [0, 0];
    let widgets = {};
    if (node.widgets && typeof node.widgets === "object") widgets = node.widgets;
    else if (Array.isArray(node[OPAQUE_WIDGETS_KEY])) {
      const out = {};
      node[OPAQUE_WIDGETS_KEY].forEach((v, i) => {
        out[String(i)] = v;
      });
      widgets = out;
    }
    nodes.set(id, { id, type, pos, widgets });
  }
  const links = new Map();
  for (const [id, tuple] of Object.entries(snap.links)) {
    if (!Array.isArray(tuple) || tuple.length < 5) continue;
    links.set(id, { id, originId: tuple[1], originSlot: Number(tuple[2]) || 0, targetId: tuple[3], targetSlot: Number(tuple[4]) || 0 });
  }
  return { nodes, links };
}

/** (c) The rejected alternative: copy and freeze every field of every node. */
function fullNodeCopy(d) {
  const freeze = (v) => {
    if (v instanceof Y.Map) {
      const o = {};
      v.forEach((x, k) => {
        o[k] = freeze(x);
      });
      return Object.freeze(o);
    }
    if (v instanceof Y.Array) return Object.freeze(v.toArray().map(freeze));
    if (Array.isArray(v)) return Object.freeze(v.map(freeze));
    if (typeof v === "object" && v !== null) {
      const o = {};
      for (const [k, x] of Object.entries(v)) o[k] = freeze(x);
      return Object.freeze(o);
    }
    return v;
  };
  return { nodes: freeze(nodesMap(d)), links: freeze(linksMap(d)) };
}

function bench(label, fn) {
  for (let i = 0; i < 5; i++) fn(doc);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < ITERS; i++) fn(doc);
  const ms = Number(process.hrtime.bigint() - t0) / ITERS / 1e6;
  console.log(`  ${label.padEnd(34)} ${ms.toFixed(4)} ms/call`);
  return ms;
}

console.log(`nodes=${NODES} links=${NODES - 1} iters=${ITERS} node=${process.version}`);
const a = bench("(a) live handle, 4 fields", liveHandleRead);
const b = bench("(b) readGraph + derive", readGraphThenDerive);
const c = bench("(c) full node copy (rejected)", fullNodeCopy);
console.log(`\n  readGraph vs live handle: ${(b / a).toFixed(2)}x  (+${(b - a).toFixed(4)} ms/frame)`);
console.log(`  full copy vs live handle: ${(c / a).toFixed(2)}x  (+${(c - a).toFixed(4)} ms/frame)`);

// The three readers must agree on what they read, or the comparison is noise.
const ra = liveHandleRead(doc);
const rb = readGraphThenDerive(doc);
const ok =
  ra.nodes.size === rb.nodes.size &&
  ra.links.size === rb.links.size &&
  JSON.stringify([...ra.nodes.values()]) === JSON.stringify([...rb.nodes.values()]) &&
  JSON.stringify([...ra.links.values()]) === JSON.stringify([...rb.links.values()]);
console.log(`\n  readers agree: ${ok} (${ra.nodes.size} nodes, ${ra.links.size} links)`);
if (!ok) process.exit(1);
