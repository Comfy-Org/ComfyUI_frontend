// V1-007 SPIKE — Yjs prototype applier (throwaway; first draft for
// Comfy-Org/comfy-multi-player).
//
// Schema candidate under test:
//   Y.Map 'nodes'  : node_id(string) -> Y.Map{ id, type, pos, size, flags, order,
//                    mode, properties (plain values), widgets_values Y.Array,
//                    inputs Y.Array<Y.Map>, outputs Y.Array<Y.Map{..., links Y.Array|null}> }
//   Y.Map 'links'  : link_id(string) -> plain [id, from, from_slot, to, to_slot, type]
//   Y.Map 'meta'   : every other top-level workflow key (groups, extra, config,
//                    version, last_node_id, last_link_id, definitions) as plain JSON
//   Y.Map '__applied' : op_id -> 1        (idempotency; see report for cost)
//   Y.Map '__stamps'  : writeTargetKey -> [base_version, actor, op_id]  (LWW)
//
// applyOps mirrors comfy_cli.workflow_ops.apply_op semantics EXACTLY:
//   * idempotent (op_id gate — checked before ANY Y mutation so a dup is a true no-op)
//   * delete-wins (missing target => silent no-op, op still marked applied)
//   * LWW for set_widget with stamp key [stamp[0], stamp[1], op_id] compared
//     elementwise (Python list comparison; ASCII strings compare identically
//     under JS UTF-16 and Python codepoint ordering)
//   * add_node payload (`op.node`) is authoritative — no schema needed
//   * set_widget resolves widget NAME -> index via the exported catalog
//     (widget order from object_info), matching _widget_index at apply time.

import * as Y from 'yjs';

// ---------------------------------------------------------------------------
// mutation accounting (spike check e: bounded writes)
// ---------------------------------------------------------------------------
let MUT = 0;
export function resetMut() { MUT = 0; }
export function getMut() { return MUT; }
const mset = (m, k, v) => { MUT++; m.set(k, v); };
const mdel = (m, k) => { MUT++; m.delete(k); };
const ains = (a, i, items) => { MUT++; a.insert(i, items); };
const adel = (a, i, n) => { MUT++; a.delete(i, n); };
const apush = (a, items) => { MUT++; a.push(items); };

// ---------------------------------------------------------------------------
// seeding / forking
// ---------------------------------------------------------------------------
function nodeToY(node) {
  const ym = new Y.Map();
  for (const [k, v] of Object.entries(node)) {
    if (k === 'widgets_values' && Array.isArray(v)) {
      const arr = new Y.Array();
      arr.push(v.map((x) => structuredClone(x)));
      ym.set(k, arr);
    } else if (k === 'inputs' && Array.isArray(v)) {
      const arr = new Y.Array();
      arr.push(v.map((inp) => plainToYMap(inp)));
      ym.set(k, arr);
    } else if (k === 'outputs' && Array.isArray(v)) {
      const arr = new Y.Array();
      arr.push(v.map((out) => outToY(out)));
      ym.set(k, arr);
    } else {
      ym.set(k, structuredClone(v));
    }
  }
  return ym;
}

function plainToYMap(obj) {
  const ym = new Y.Map();
  for (const [k, v] of Object.entries(obj)) ym.set(k, structuredClone(v));
  return ym;
}

function outToY(out) {
  const ym = new Y.Map();
  for (const [k, v] of Object.entries(out)) {
    if (k === 'links' && Array.isArray(v)) {
      const arr = new Y.Array();
      arr.push(v.map((x) => x));
      ym.set(k, arr);
    } else {
      ym.set(k, structuredClone(v)); // preserves links: null verbatim
    }
  }
  return ym;
}

export function seedDoc(base) {
  const doc = new Y.Doc();
  doc.transact(() => {
    const meta = doc.getMap('meta');
    for (const [k, v] of Object.entries(base)) {
      if (k === 'nodes' || k === 'links' || k === '_applied_ops' || k === '_widget_stamps') continue;
      meta.set(k, structuredClone(v));
    }
    const nodes = doc.getMap('nodes');
    for (const n of base.nodes || []) nodes.set(String(n.id), nodeToY(n));
    const links = doc.getMap('links');
    for (const ln of base.links || []) links.set(String(ln[0]), structuredClone(ln));
    doc.getMap('__applied');
    doc.getMap('__stamps');
  });
  return doc;
}

// Replicas MUST bootstrap from the same update; re-seeding locally would mint
// duplicate structs (Y.Array seeds would double on merge). A real finding — see report.
export function forkDoc(doc) {
  const d2 = new Y.Doc();
  Y.applyUpdate(d2, Y.encodeStateAsUpdate(doc));
  return d2;
}

export function syncDocs(a, b) {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
}

export function docBytes(doc) {
  return Buffer.from(Y.encodeStateAsUpdate(doc));
}

// ---------------------------------------------------------------------------
// LWW machinery — mirrors _stamp_key/_lww_gate/_lww_commit/_write_target
// ---------------------------------------------------------------------------
function stampKey(op) {
  const stamp = op.stamp ?? [op.base_version ?? 0, op.actor ?? ''];
  return [stamp[0], stamp[1], op.op_id];
}

function cmpKey(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

function writeTarget(op) {
  if (op.op === 'set_widget') {
    if (op.path) return ['widget', op.path.map(String), op.inner_widget];
    return ['widget', op.node_id, op.widget];
  }
  if (op.op === 'add_node' || op.op === 'delete_node') return ['node', op.node_id];
  if (op.op === 'connect') {
    if (op.grow != null) return ['input', op.to_node, 'grow', String(op.grow.name).split('.')[0]];
    return ['input', op.to_node, op.to_slot];
  }
  return [op.op];
}

function lwwGate(doc, op) {
  const prior = doc.getMap('__stamps').get(JSON.stringify(writeTarget(op)));
  return prior == null || cmpKey(stampKey(op), prior) > 0;
}

function lwwCommit(doc, op) {
  mset(doc.getMap('__stamps'), JSON.stringify(writeTarget(op)), stampKey(op));
}

// ---------------------------------------------------------------------------
// applyOp
// ---------------------------------------------------------------------------
export function applyOp(doc, op, catalog) {
  const applied = doc.getMap('__applied');
  if (applied.has(op.op_id)) return 'dup';
  let result = 'ok';
  doc.transact(() => {
    switch (op.op) {
      case 'add_node': result = applyAddNode(doc, op); break;
      case 'set_widget': result = applySetWidget(doc, op, catalog); break;
      case 'connect': result = applyConnect(doc, op, catalog); break;
      case 'delete_node': result = applyDeleteNode(doc, op); break;
      case 'clear': result = applyClear(doc, op); break;
      default: throw new Error(`unknown op ${op.op}`);
    }
    mset(applied, op.op_id, 1); // python appends op_id even for no-op targets
  });
  return result;
}

function widgetIndex(catalog, classType, widget) {
  const entry = catalog[classType];
  if (!entry) throw new Error(`class_type ${classType} not in exported catalog`);
  const idx = entry.widget_order.indexOf(widget);
  if (idx < 0) throw new Error(`widget ${widget} not found on ${classType}`);
  return idx;
}

function applyAddNode(doc, op) {
  const nodes = doc.getMap('nodes');
  const key = String(op.node_id);
  if (nodes.has(key)) return 'exists';
  mset(nodes, key, nodeToY(op.node));
  const meta = doc.getMap('meta');
  const cur = meta.get('last_node_id') ?? 0;
  // Monotone write only — python always assigns max(cur, id); writing only on
  // increase keeps sequential parity and avoids a pointless Yjs struct. This is
  // NOT a correct concurrent max-register (see report).
  if (op.node_id > cur) mset(meta, 'last_node_id', op.node_id);
  return 'ok';
}

function applySetWidget(doc, op, catalog) {
  if (!lwwGate(doc, op)) return 'lww-dropped';
  const nodes = doc.getMap('nodes');
  if (op.path) {
    // Subgraph interior write. Definitions live as ONE plain JSON value in meta,
    // so this is a read-modify-write of the whole definitions blob (unbounded —
    // flagged in report). Single-instance defs only: the deterministic
    // definition-forking of _isolate_shared_subgraph is NOT implemented.
    const head = nodes.get(String(op.path[0]));
    if (!head) return 'deleted-target';
    const meta = doc.getMap('meta');
    const defs = structuredClone(meta.get('definitions') ?? {});
    const byId = {};
    for (const sg of defs.subgraphs ?? []) if (sg && sg.id) byId[String(sg.id)] = sg;
    let curType = head.get('type');
    let cur = null;
    for (const seg of op.path.slice(1)) {
      const sg = byId[String(curType)];
      if (!sg) throw new Error(`node is not a subgraph; cannot descend to ${seg}`);
      cur = (sg.nodes ?? []).find((n) => String(n.id) === String(seg));
      if (!cur) throw new Error(`interior node ${seg} not found in subgraph ${sg.id}`);
      curType = cur.type;
    }
    const idx = widgetIndex(catalog, cur.type, op.inner_widget);
    const w = Array.isArray(cur.widgets_values) ? cur.widgets_values : [];
    if (idx >= w.length) throw new Error(`widget index ${idx} out of range (interior writes never pad)`);
    w[idx] = structuredClone(op.value);
    cur.widgets_values = w;
    mset(meta, 'definitions', defs);
    lwwCommit(doc, op);
    return 'ok';
  }
  const node = nodes.get(String(op.node_id));
  if (!node) return 'deleted-target'; // delete wins
  const idx = widgetIndex(catalog, node.get('type'), op.widget);
  let w = node.get('widgets_values');
  if (!(w instanceof Y.Array)) {
    w = new Y.Array();
    mset(node, 'widgets_values', w);
  }
  while (w.length < idx) apush(w, [null]); // python pads with None
  if (w.length === idx) {
    ains(w, idx, [structuredClone(op.value)]);
  } else {
    adel(w, idx, 1);
    ains(w, idx, [structuredClone(op.value)]);
  }
  lwwCommit(doc, op);
  return 'ok';
}

function nextAutogrowName(ins, requested, template) {
  const taken = new Set(ins.toArray().map((i) => i.get('name')));
  if (!taken.has(requested)) return requested;
  const base = String(requested).split('.')[0];
  const elem = (n) => {
    if (template?.names?.length) return n < template.names.length ? template.names[n] : `${template.names.at(-1)}${n}`;
    if (template?.prefix) return `${template.prefix}${n}`;
    const stem = base.endsWith('s') ? base.slice(0, -1) : base;
    return `${stem}${n}`;
  };
  let n = 0;
  while (taken.has(`${base}.${elem(n)}`)) n++;
  return `${base}.${elem(n)}`;
}

function applyConnect(doc, op, catalog) {
  const nodes = doc.getMap('nodes');
  const dst = nodes.get(String(op.to_node));
  const src = nodes.get(String(op.from_node));
  if (!dst || !src) return 'deleted-endpoint'; // delete wins
  let toIdx;
  const grow = op.grow;
  if (grow != null) {
    if (grow.inputcount != null) {
      throw new Error('inputcount-family grow not implemented in prototype (no fixture coverage)');
    }
    let ins = dst.get('inputs');
    if (!(ins instanceof Y.Array)) {
      ins = new Y.Array();
      mset(dst, 'inputs', ins);
    }
    toIdx = null;
    ins.forEach((inp, i) => { if (inp.get('grow_id') === op.link_id) toIdx = i; });
    if (toIdx == null) {
      const base = String(grow.name).split('.')[0];
      const template = catalog[dst.get('type')]?.autogrow_templates?.[base] ?? null;
      const name = nextAutogrowName(ins, grow.name, grow.widget ? null : template);
      const ym = new Y.Map();
      ym.set('name', name);
      ym.set('type', grow.type);
      ym.set('link', null);
      ym.set('grow_id', op.link_id);
      if (grow.widget) ym.set('widget', { name: grow.widget });
      apush(ins, [ym]);
      toIdx = ins.length - 1;
    }
  } else {
    toIdx = op.to_slot;
    const inp = dst.get('inputs').get(toIdx);
    const prev = inp.get('link');
    if (prev != null && prev !== op.link_id) removeLink(doc, prev);
  }
  const links = doc.getMap('links');
  const lk = String(op.link_id);
  if (!links.has(lk)) {
    mset(links, lk, [op.link_id, op.from_node, op.from_slot, op.to_node, toIdx, op.link_type]);
  }
  mset(dst.get('inputs').get(toIdx), 'link', op.link_id);
  const out = src.get('outputs').get(op.from_slot);
  let ol = out.get('links');
  if (ol == null || !(ol instanceof Y.Array)) {
    ol = new Y.Array(); // mirrors the `"links": null` guard in _apply_connect
    mset(out, 'links', ol);
  }
  if (!ol.toArray().includes(op.link_id)) apush(ol, [op.link_id]);
  return 'ok';
}

function removeLink(doc, linkId) {
  const links = doc.getMap('links');
  if (links.has(String(linkId))) mdel(links, String(linkId));
  doc.getMap('nodes').forEach((node) => {
    const ins = node.get('inputs');
    if (ins instanceof Y.Array) {
      ins.forEach((inp) => { if (inp.get('link') === linkId) mset(inp, 'link', null); });
    }
    const outs = node.get('outputs');
    if (outs instanceof Y.Array) {
      outs.forEach((out) => {
        const ol = out.get('links');
        if (ol instanceof Y.Array) {
          const arr = ol.toArray();
          for (let i = arr.length - 1; i >= 0; i--) if (arr[i] === linkId) adel(ol, i, 1);
        }
      });
    }
  });
}

function applyDeleteNode(doc, op) {
  const nodes = doc.getMap('nodes');
  const key = String(op.node_id);
  if (nodes.has(key)) mdel(nodes, key);
  const links = doc.getMap('links');
  const removed = new Set(op.removed_links ?? []);
  const toDelete = [];
  links.forEach((ln, k) => {
    if (removed.has(ln[0]) || ln[1] === op.node_id || ln[3] === op.node_id) toDelete.push(k);
  });
  for (const k of toDelete) mdel(links, k);
  const keptIds = new Set();
  links.forEach((ln) => keptIds.add(ln[0]));
  // Scrub dangling references (bounded by the degree of the deleted node).
  nodes.forEach((node) => {
    const ins = node.get('inputs');
    if (ins instanceof Y.Array) {
      ins.forEach((inp) => {
        const l = inp.get('link');
        if (l != null && !keptIds.has(l)) mset(inp, 'link', null);
      });
    }
    const outs = node.get('outputs');
    if (outs instanceof Y.Array) {
      outs.forEach((out) => {
        const ol = out.get('links');
        if (ol instanceof Y.Array) {
          const arr = ol.toArray();
          for (let i = arr.length - 1; i >= 0; i--) if (!keptIds.has(arr[i])) adel(ol, i, 1);
        }
      });
    }
  });
  return 'ok';
}

function applyClear(doc, op) {
  const nodes = doc.getMap('nodes');
  const links = doc.getMap('links');
  for (const k of [...nodes.keys()]) mdel(nodes, k);
  for (const k of [...links.keys()]) mdel(links, k);
  const meta = doc.getMap('meta');
  if (meta.has('groups')) mset(meta, 'groups', []); // python clears groups only if present
  return 'ok';
}

// ---------------------------------------------------------------------------
// projection: doc -> workflow JSON
// ---------------------------------------------------------------------------
function projectNode(ym) {
  const node = {};
  ym.forEach((v, k) => {
    if (v instanceof Y.Array) {
      node[k] = v.toArray().map((x) => (x instanceof Y.Map ? projectPlainMap(x) : structuredClone(x)));
    } else if (v instanceof Y.Map) {
      node[k] = projectPlainMap(v);
    } else {
      node[k] = structuredClone(v);
    }
  });
  return node;
}

function projectPlainMap(ym) {
  const obj = {};
  ym.forEach((v, k) => {
    obj[k] = v instanceof Y.Array ? v.toArray().map((x) => structuredClone(x)) : structuredClone(v);
  });
  return obj;
}

export function project(doc) {
  const wf = {};
  doc.getMap('meta').forEach((v, k) => { wf[k] = structuredClone(v); });
  const nodes = [];
  doc.getMap('nodes').forEach((ym) => nodes.push(projectNode(ym)));
  // Y.Map has no order: impose deterministic order by id. This LOSES the
  // original insertion order (execution `order` field still carried per node) —
  // a principled projection normalization, reported as a fidelity finding.
  nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  wf.nodes = nodes;
  const links = [];
  doc.getMap('links').forEach((ln) => links.push(structuredClone(ln)));
  links.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  wf.links = links;
  return wf;
}
