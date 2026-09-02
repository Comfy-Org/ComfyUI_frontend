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
  metaMap,
  nodesMap,
  stampsMap,
} from "./doc.js";
import { SCHEMA_VERSION, type WidgetCatalog, type WorkflowJSON, type WorkflowNode } from "./types.js";

/** Top-level keys that are NOT meta passthrough: structural keys get their own root maps; comfy-cli bookkeeping is never imported. */
const NON_META_KEYS = ["nodes", "links", "definitions", "_applied_ops", "_widget_stamps"] as const;

/** Meta keys owned by the doc itself — a workflow must not carry them. */
const RESERVED_META_KEYS = ["schema_version", "catalog_version"] as const;

/** OWN-property lookup: an inherited key such as `__proto__` must read as "missing", not as a catalog entry (#13). */
function widgetOrderFor(catalog: WidgetCatalog, nodeType: string): readonly string[] | undefined {
  if (typeof nodeType !== "string" || !Object.hasOwn(catalog.types, nodeType)) return undefined;
  return catalog.types[nodeType]?.widget_order;
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
 *   `node_order`/`link_order` registers (interior order is static in v1 —
 *   only `set_widget` is subgraph-scoped); non-`subgraphs` keys of the
 *   definitions container are kept in the internal `__definitions_extra`
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

    for (const [k, v] of Object.entries(workflow)) {
      if (NON_META_KEYS.includes(k as (typeof NON_META_KEYS)[number])) continue;
      if (RESERVED_META_KEYS.includes(k as (typeof RESERVED_META_KEYS)[number]) || k.startsWith("__")) {
        throw new TypeError(`mint: workflow key '${k}' collides with a reserved doc-meta key`);
      }
      meta.set(k, cloneForMap(v, `mint: workflow.${k}`));
    }

    const nodes = nodesMap(doc);
    for (const node of workflow.nodes ?? []) {
      nodes.set(String(node.id), createNodeMap(node, widgetOrderFor(catalog, node.type)));
    }

    const links = linksMap(doc);
    for (const ln of workflow.links ?? []) {
      links.set(String((ln as unknown[])[0]), cloneForMap(ln, "mint: link"));
    }

    const defsIn = workflow["definitions"];
    if (defsIn !== undefined && defsIn !== null) {
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
      meta.set("__definitions_extra", extra);
      const defsRoot = definitionsMap(doc);
      for (const sg of Array.isArray(subgraphs) ? (subgraphs as SubgraphDef[]) : []) {
        defsRoot.set(String(sg.id), mintDefinition(sg, catalog));
      }
    }
  });
  return doc;
}

/**
 * The `links` map key for one interior link of a definition: the tuple's
 * `[0]` for the litegraph array form, `id` for the frontend's object form, and
 * the link's mint position for anything else (so an id-less entry still
 * occupies its own key rather than colliding on `"undefined"`).
 */
function definitionLinkKey(ln: unknown, index: number): string {
  if (Array.isArray(ln) && ln[0] !== undefined) return String(ln[0]);
  if (typeof ln === "object" && ln !== null && !Array.isArray(ln)) {
    const id = (ln as { id?: unknown }).id;
    if (id !== undefined && id !== null) return String(id);
  }
  return `#${String(index)}`;
}

function mintDefinition(sg: SubgraphDef, catalog: WidgetCatalog): Y.Map<unknown> {
  const dm = new Y.Map<unknown>();
  for (const [k, v] of Object.entries(sg)) {
    if (k === "nodes" && Array.isArray(v)) {
      const nm = new Y.Map<Y.Map<unknown>>();
      const order: string[] = [];
      for (const n of v as WorkflowNode[]) {
        const key = String(n.id);
        order.push(key);
        nm.set(key, createNodeMap(n, widgetOrderFor(catalog, n.type)));
      }
      dm.set("nodes", nm);
      dm.set("node_order", order);
    } else if (k === "links" && Array.isArray(v)) {
      const lm = new Y.Map<unknown>();
      const order: string[] = [];
      v.forEach((ln, i) => {
        // A definition's interior links are serialized by the frontend as
        // OBJECTS (`{id, origin_id, origin_slot, target_id, target_slot,
        // type}`), not top-level tuples. Keying every shape by `ln[0]` read
        // `undefined` off each object, so every interior link of a real
        // template collapsed onto one key and the round trip emitted the last
        // one N times (found by the z-image turbo fixture, Amendment A15).
        const key = definitionLinkKey(ln, i);
        order.push(key);
        lm.set(key, cloneForMap(ln, `mint: definition link ${key}`));
      });
      dm.set("links", lm);
      dm.set("link_order", order);
    } else {
      dm.set(k, cloneForMap(v, `mint: definition.${k}`));
    }
  }
  return dm;
}
