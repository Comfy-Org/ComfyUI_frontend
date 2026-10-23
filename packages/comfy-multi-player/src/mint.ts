/**
 * mint(): import an existing workflow JSON into a fresh Y.Doc (schema §9 —
 * the lazy-mint at cutover). The mint() output is THE bootstrap snapshot:
 * every replica forks from it via `Y.applyUpdate(new Y.Doc(),
 * Y.encodeStateAsUpdate(minted))` — a replica MUST NEVER independently
 * re-seed the same base workflow. Under the v1 Y.Map-keyed layout the
 * consequence is silent whole-node LWW clobber of a diverged replica's edits,
 * not the Y.Array content doubling schema §9 describes; both halves are
 * measured in `docs/INVARIANTS.md` KA-10.
 */

import * as Y from "yjs";
import {
  appliedMap,
  cloneForMap,
  createNodeMap,
  definitionsMap,
  linksMap,
  linkStateMap,
  metaMap,
  nodesMap,
  stampsMap,
} from "./doc.js";
import {
  LINK_STATE_DESCRIPTOR_VERSION,
  SCHEMA_VERSION,
  type ImportedLinkDestination,
  type ImportedLinkState,
  type LinkTuple,
  type WidgetCatalog,
  type WorkflowJSON,
  type WorkflowNode,
} from "./types.js";
import { widgetOrderForValues } from "./dynamic-combos.js";

/** Top-level keys that are NOT meta passthrough: structural keys get their own root maps; comfy-cli bookkeeping is never imported. */
const NON_META_KEYS = ["nodes", "links", "definitions", "_applied_ops", "_widget_stamps"] as const;

/** Meta keys owned by the doc itself — a workflow must not carry them. */
const RESERVED_META_KEYS = ["schema_version", "catalog_version"] as const;

/** OWN-property lookup: an inherited key such as `__proto__` must read as "missing", not as a catalog entry (#13). */
function widgetOrderFor(catalog: WidgetCatalog, nodeType: string, wv: unknown): readonly string[] | undefined {
  if (typeof nodeType !== "string" || !Object.hasOwn(catalog.types, nodeType)) return undefined;
  // Selection-aware: a dynamic combo's non-default option names its own slots.
  return widgetOrderForValues(catalog.types[nodeType], wv);
}

interface SubgraphDef {
  id?: unknown;
  nodes?: unknown[];
  links?: unknown[];
  [key: string]: unknown;
}

/**
 * Import `workflow` into a fresh doc:
 * - nodes/links into their root maps (widgets decomposed to the name-keyed
 *   map through `catalog` — schema §1.2);
 * - `definitions.subgraphs` into the first-class `definitions` root map
 *   (schema §5.1), with interior node/link mint order preserved in plain
 *   `node_order`/`link_order` registers; later interior links retain this
 *   imported prefix and project in deterministic stamp order;
 *   non-`subgraphs` keys of the definitions container are kept in the internal `__definitions_extra`
 *   meta key and merged back at projection;
 * - every other top-level key into meta as opaque passthrough (schema §6);
 * - `schema_version` + the pinned `catalogVersion` into meta.
 *
 * `project(mint(w, catalog), catalog)` deep-equals `w` modulo the schema §7
 * canonicalization (sorted-by-id node/link order).
 *
 * Passthrough writes go through the SAME gate as the node builders
 * ({@link cloneForMap}), which asks whether the doc can hold the value AND
 * whether the value survives its own encoding. Three shapes that minted before
 * now do not: a reference cycle (which produced a doc that could never be
 * encoded — #14), a `Date`, and a `BigInt` outside int64. None of the three can
 * reach `mint` from a JSON producer, since a base workflow always arrives as
 * JSON and none of them survives `JSON.stringify`/`json.dumps`.
 *
 * The gates stay SHALLOW apart from the cycle walk: an unstorable or lossy
 * value nested inside an accepted container still passes, and is silently
 * coerced at encode time rather than rejected — see {@link encodingLosses} and
 * decision D4.
 */
export function mint(workflow: WorkflowJSON, catalog: WidgetCatalog, catalogVersion = ""): Y.Doc {
  const doc = new Y.Doc();
  doc.transact(() => {
    const meta = metaMap(doc);
    meta.set("schema_version", SCHEMA_VERSION);
    meta.set("catalog_version", catalogVersion);
    nodesMap(doc);
    linksMap(doc);
    definitionsMap(doc);
    appliedMap(doc);
    stampsMap(doc);
    const linkState = linkStateMap(doc);

    for (const [k, v] of Object.entries(workflow)) {
      if (NON_META_KEYS.includes(k as (typeof NON_META_KEYS)[number])) continue;
      if (RESERVED_META_KEYS.includes(k as (typeof RESERVED_META_KEYS)[number]) || k.startsWith("__")) {
        throw new TypeError(`mint: workflow key '${k}' collides with a reserved doc-meta key`);
      }
      meta.set(k, cloneForMap(v, `mint: workflow.${k}`));
    }

    const nodes = nodesMap(doc);
    for (const node of workflow.nodes ?? []) {
      nodes.set(String(node.id), createNodeMap(node, widgetOrderFor(catalog, node.type, node.widgets_values)));
    }

    const links = linksMap(doc);
    for (const ln of workflow.links ?? []) {
      const tuple = cloneForMap(ln, "mint: link");
      const state = importedLinkState(tuple, workflow);
      const key = String((tuple as unknown[])[0]);
      links.set(key, tuple);
      if (state === null) linkState.delete(key);
      else linkState.set(key, cloneForMap(state, `mint: link state ${key}`));
    }

    mintWorkflowDefinitions(doc, workflow["definitions"], catalog);
  });
  return doc;
}

function mintWorkflowDefinitions(doc: Y.Doc, defsIn: unknown, catalog: WidgetCatalog): void {
  if (defsIn === undefined || defsIn === null) return;
  if (typeof defsIn !== "object" || Array.isArray(defsIn)) {
    throw new TypeError("mint: workflow.definitions must be an object");
  }
  const { subgraphs, ...rest } = defsIn as { subgraphs?: unknown; [key: string]: unknown };
  // The fifth ungated passthrough write: `__definitions_extra` reached a
  // Y.Map through a bare `structuredClone`. Shallow verdicts are unchanged
  // (`rest` is always a plain object), but a cycle inside it would have
  // bricked the document exactly as any other passthrough would.
  const extra = cloneForMap(rest, "mint: workflow.definitions") as Record<string, unknown>;
  // Preserve an explicitly-empty subgraphs array through the round trip.
  if (Array.isArray(subgraphs) && subgraphs.length === 0) extra["subgraphs"] = [];
  metaMap(doc).set("__definitions_extra", extra);
  const defsRoot = definitionsMap(doc);
  for (const sg of Array.isArray(subgraphs) ? (subgraphs as SubgraphDef[]) : []) {
    if (sg.id === undefined || sg.id === null) throw new TypeError("mint: definition is missing id");
    defsRoot.set(String(sg.id), mintDefinition(sg, catalog));
  }
}

function nodeId(value: unknown, context: string): string | number {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  throw new TypeError(`mint: ${context} must be a non-empty string or safe integer`);
}

function recordAt(value: unknown, index: number, context: string): Record<string, unknown> | null {
  if (!Array.isArray(value) || index >= value.length) return null;
  const slot = value[index];
  if (typeof slot !== "object" || slot === null || Array.isArray(slot)) {
    throw new TypeError(`mint: ${context} slot ${String(index)} is not an object`);
  }
  return slot as Record<string, unknown>;
}

function retainedNode(workflow: WorkflowJSON, id: string | number): WorkflowNode | undefined {
  for (let index = workflow.nodes.length - 1; index >= 0; index -= 1) {
    const node = workflow.nodes[index];
    if (node !== undefined && String(node.id) === String(id)) return node;
  }
  return undefined;
}

/** Build durable intent only when an imported tuple and both endpoint slot references agree. */
export function importedLinkState(raw: unknown, workflow: WorkflowJSON): ImportedLinkState | null {
  if (!Array.isArray(raw) || raw.length !== 6) {
    throw new TypeError("mint: link tuple must contain exactly six fields");
  }
  const [id, fromNodeId, fromSlot, toNodeId, toSlot] = raw;
  const linkId = nodeId(id, "link tuple id");
  const sourceId = nodeId(fromNodeId, `link ${String(linkId)} source node id`);
  const targetId = nodeId(toNodeId, `link ${String(linkId)} destination node id`);
  if (!Number.isSafeInteger(fromSlot) || (fromSlot as number) < 0 || !Number.isSafeInteger(toSlot) || (toSlot as number) < 0) {
    throw new TypeError(`mint: link ${String(id)} tuple slots must be non-negative integers`);
  }
  const source = retainedNode(workflow, sourceId);
  const target = retainedNode(workflow, targetId);
  // Existing workflow JSON can carry a dangling tuple while a save is in
  // progress or after an older producer incompletely scrubbed a node. mint()
  // has always preserved those tuples. They cannot yield a truthful durable
  // destination descriptor, so preserve the link and omit only __link_state.
  if (source === undefined || target === undefined) return null;
  const output = recordAt(source.outputs, fromSlot as number, `link ${String(id)} source output`);
  const input = recordAt(target.inputs, toSlot as number, `link ${String(id)} destination input`);
  if (output === null || input === null) return null;
  if (!Array.isArray(output["links"]) || !output["links"].some((ref) =>
    (typeof ref === "string" || typeof ref === "number") && String(ref) === String(linkId))) {
    return null;
  }
  if ((typeof input["link"] !== "string" && typeof input["link"] !== "number") ||
      String(input["link"]) !== String(linkId)) {
    return null;
  }

  const definitions = workflow["definitions"];
  const subgraphsValue = typeof definitions === "object" && definitions !== null && !Array.isArray(definitions)
    ? (definitions as Record<string, unknown>)["subgraphs"]
    : undefined;
  const subgraphs = Array.isArray(subgraphsValue)
    ? subgraphsValue.filter((value): value is SubgraphDef => typeof value === "object" && value !== null && !Array.isArray(value))
    : [];
  const definition = subgraphs.find((candidate) =>
    String(candidate.id) === String(target.type) ||
    (typeof candidate["name"] === "string" && candidate["name"] === target.type),
  );
  const declaredInputs = Array.isArray(definition?.["inputs"])
    ? definition["inputs"].filter((value): value is Record<string, unknown> =>
        typeof value === "object" && value !== null && !Array.isArray(value))
    : [];
  const slot = input;
  const name = slot["name"];
  let destination: ImportedLinkDestination;
  if (typeof name === "string" && declaredInputs.some((declared) => declared["name"] === name)) {
    destination = { kind: "promoted", to_slot: toSlot as number, name, slot: structuredClone(slot) };
  } else if (String(slot["grow_id"]) === String(id)) {
    destination = { kind: "autogrow", to_slot: toSlot as number, slot: structuredClone(slot) };
  } else {
    destination = { kind: "concrete", to_slot: toSlot as number, slot: structuredClone(slot) };
  }
  return {
    version: LINK_STATE_DESCRIPTOR_VERSION,
    authority: "imported",
    tuple: structuredClone(raw) as LinkTuple,
    destination,
  };
}

/**
 * The explicit `links` map key for one interior link of a definition: the
 * tuple's `[0]` for the litegraph array form or `id` for the frontend's object
 * form. ID-less links receive a collision-free positional key in
 * `mintDefinition` after all explicit keys have been reserved.
 */
function definitionLinkKey(ln: unknown): string | undefined {
  if (Array.isArray(ln) && ln[0] !== undefined) return String(ln[0]);
  if (typeof ln === "object" && ln !== null && !Array.isArray(ln)) {
    const id = (ln as { id?: unknown }).id;
    if (id !== undefined && id !== null) return String(id);
  }
  return undefined;
}

function mintDefinitionNodes(dm: Y.Map<unknown>, nodes: WorkflowNode[], catalog: WidgetCatalog): void {
  const nm = new Y.Map<Y.Map<unknown>>();
  const order: string[] = [];
  for (const node of nodes) {
    if (node.id === undefined || node.id === null) throw new TypeError("mint: definition node is missing id");
    const key = String(node.id);
    if (order.includes(key)) throw new TypeError(`mint: duplicate definition node id '${key}'`);
    order.push(key);
    nm.set(key, createNodeMap(node, widgetOrderFor(catalog, node.type, node.widgets_values)));
  }
  dm.set("nodes", nm);
  dm.set("node_order", order);
}

function mintDefinitionLinks(dm: Y.Map<unknown>, links: unknown[]): void {
  const lm = new Y.Map<unknown>();
  const order: string[] = [];
  const usedKeys = new Set<string>();
  for (const link of links) {
    const key = definitionLinkKey(link);
    if (key === undefined) continue;
    if (usedKeys.has(key)) throw new TypeError(`mint: duplicate definition link id '${key}'`);
    usedKeys.add(key);
  }
  links.forEach((ln, i) => {
    // A definition's interior links are serialized by the frontend as
    // OBJECTS (`{id, origin_id, origin_slot, target_id, target_slot,
    // type}`), not top-level tuples. Keying every shape by `ln[0]` read
    // `undefined` off each object, so every interior link of a real
    // template collapsed onto one key and the round trip emitted the last
    // one N times (found by the z-image turbo fixture, Amendment A15).
    const explicitKey = definitionLinkKey(ln);
    let key = explicitKey ?? `#${String(i)}`;
    if (explicitKey === undefined) {
      const base = key;
      let suffix = 1;
      while (usedKeys.has(key)) {
        key = `${base}~${String(suffix)}`;
        suffix += 1;
      }
      usedKeys.add(key);
    }
    order.push(key);
    lm.set(key, cloneForMap(ln, `mint: definition link ${key}`));
  });
  dm.set("links", lm);
  dm.set("link_order", order);
}

function mintNestedDefinitions(value: object, catalog: WidgetCatalog): Y.Map<unknown> {
  const container = new Y.Map<unknown>();
  const { subgraphs, ...extra } = value as { subgraphs?: unknown; [key: string]: unknown };
  Object.entries(extra).forEach(([key, entry]) => container.set(key, cloneForMap(entry, `mint: definition.definitions.${key}`)));
  if (Array.isArray(subgraphs)) {
    const nested = new Y.Map<Y.Map<unknown>>();
    const order: string[] = [];
    for (const child of subgraphs as SubgraphDef[]) {
      if (child.id === undefined || child.id === null) throw new TypeError("mint: nested definition is missing id");
      const key = String(child.id);
      if (order.includes(key)) throw new TypeError(`mint: duplicate nested definition id '${key}'`);
      order.push(key);
      nested.set(key, mintDefinition(child, catalog));
    }
    container.set("subgraphs", nested);
    container.set("subgraph_order", order);
  }
  return container;
}

export function mintDefinition(sg: SubgraphDef, catalog: WidgetCatalog): Y.Map<unknown> {
  for (const key of ["node_order", "link_order", "__definition_digest"]) {
    if (Object.hasOwn(sg, key)) throw new TypeError(`mint: definition key '${key}' is reserved`);
  }
  const dm = new Y.Map<unknown>();
  for (const [k, v] of Object.entries(sg)) {
    if (k === "nodes" && Array.isArray(v)) {
      mintDefinitionNodes(dm, v as WorkflowNode[], catalog);
    } else if (k === "links" && Array.isArray(v)) {
      mintDefinitionLinks(dm, v);
    } else if (k === "definitions" && typeof v === "object" && v !== null && !Array.isArray(v)) {
      dm.set("definitions", mintNestedDefinitions(v, catalog));
    } else {
      dm.set(k, cloneForMap(v, `mint: definition.${k}`));
    }
  }
  return dm;
}
