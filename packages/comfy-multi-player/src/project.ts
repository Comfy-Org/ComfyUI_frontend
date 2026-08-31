/**
 * Canonical projection: Y.Doc → ComfyUI workflow JSON (schema §7).
 *
 * Pure read; byte-stable for a given doc state so browser and server render
 * identical JSON. Canonicalization rules:
 *   1. node and link arrays sorted by id (Y.Map is unordered; sorted-by-id IS
 *      the canonical order — execution `order` is node state and preserved);
 *   2. the name-keyed `widgets` map is emitted as the positional
 *      `widgets_values` array via the pinned catalog's `widget_order`;
 *      missing interior names project as null (Python pads with None), and
 *      the array length is 1 + the highest widget index present. A node stored
 *      opaquely (`__widgets_opaque` — a class the catalog does not know, e.g.
 *      the frontend-only `Note`/`MarkdownNote`) emits its array verbatim;
 *   3. numbers serialize as JS numbers;
 *   4. `outputs[].links: null` preserved verbatim; an empty Y.Array → `[]`;
 *   5. meta passthrough keys project unmodified (schema §6). Doc-internal
 *      meta keys (`schema_version`, `catalog_version`, `__`-prefixed) are
 *      NOT workflow keys and are excluded.
 *
 * Subgraph definitions project as `{...extra, subgraphs: [...]}` with
 * definitions sorted by id and each definition's interior nodes/links in
 * mint order (`node_order`/`link_order` — interior order is static in v1
 * because only `set_widget` is subgraph-scoped).
 */

import * as Y from "yjs";
import {
  OPAQUE_WIDGETS_KEY,
  definitionsMap,
  linksMap,
  metaMap,
  nodesMap,
  widgetStorageOf,
} from "./doc.js";
import { assertNever } from "./exhaustive.js";
import { assertReadableSchema } from "./schema-version.js";
import { NODE_INCARNATION_KEY, type WidgetCatalog, type WorkflowJSON, type WorkflowNode } from "./types.js";

/** Sorted-by-id comparator: numeric when both ids are numbers, else string order. */
function idCompare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/** Source-output references are link identities, whose canonical order is numeric. */
function linkIdCompare(a: unknown, b: unknown): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return idCompare(a, b);
}

function yMapToObject(m: Y.Map<unknown>): Record<string, unknown> {
  const obj: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  m.forEach((v, k) => {
    obj[k] = v instanceof Y.Array ? v.toArray().map((x) => structuredClone(x)) : structuredClone(v);
  });
  return obj;
}

/** Slot record Y.Map → plain object; nested `links` Y.Array → array, null preserved. */
function projectSlot(slot: unknown): unknown {
  if (!(slot instanceof Y.Map)) return structuredClone(slot);
  return yMapToObject(slot);
}

/** Output slot projection additionally canonicalizes its set-valued source refs. */
function projectOutputSlot(slot: unknown): unknown {
  const out = projectSlot(slot);
  if (typeof out !== "object" || out === null) return out;
  const record = out as Record<string, unknown>;
  if (Array.isArray(record["links"])) {
    record["links"] = [...record["links"]].sort(linkIdCompare);
  }
  return record;
}

/** Name-keyed widgets map → positional widgets_values (§7 rule 2). */
function widgetsToPositional(
  nodeType: string,
  widgets: Y.Map<unknown>,
  catalog: WidgetCatalog,
): unknown[] {
  if (widgets.size === 0) return [];
  const entry = Object.hasOwn(catalog.types, nodeType) ? catalog.types[nodeType] : undefined;
  if (!entry) {
    throw new TypeError(
      `project: type '${nodeType}' has widget values but is not in the pinned catalog (schema §1.2 — projection is catalog-dependent by design)`,
    );
  }
  const order = entry.widget_order;
  let max = -1;
  widgets.forEach((_v, name) => {
    const i = order.indexOf(name);
    if (i < 0) {
      throw new TypeError(`project: widget '${name}' is not in widget_order for ${nodeType}`);
    }
    if (i > max) max = i;
  });
  const out: unknown[] = [];
  for (let i = 0; i <= max; i++) {
    const name = order[i]!;
    out.push(widgets.has(name) ? structuredClone(widgets.get(name)) : null);
  }
  return out;
}

/**
 * Project a node's widget values back to positional `widgets_values`,
 * dispatching on the node's storage strategy (schema §1.2) rather than on
 * whichever of the two storage keys the projection loop happened to reach
 * first. Issue #21: the strategy is the thing being decided, so it is the
 * thing switched on, and the guard below is what a third strategy trips.
 */
function projectWidgets(
  nodeType: string,
  ym: Y.Map<unknown>,
  catalog: WidgetCatalog,
): unknown {
  const storage = widgetStorageOf(ym);
  switch (storage) {
    case "opaque":
      // Opaque whole-array storage for a class the catalog cannot describe
      // (schema §1.2): emitted VERBATIM, no catalog lookup, no re-keying.
      return structuredClone(ym.get(OPAQUE_WIDGETS_KEY));
    case "named":
      return widgetsToPositional(nodeType, ym.get("widgets") as Y.Map<unknown>, catalog);
    default:
      return assertNever(storage, "project: widget-storage strategy");
  }
}

/** Per-node Y.Map → workflow node JSON. Emits exactly the keys stored at mint/apply time. */
function projectNode(ym: Y.Map<unknown>, catalog: WidgetCatalog): WorkflowNode {
  const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  const nodeType = String(ym.get("type") ?? "");
  ym.forEach((v, k) => {
    if (k === NODE_INCARNATION_KEY) {
      return;
    } else if (k === OPAQUE_WIDGETS_KEY || k === "widgets") {
      // Both storage keys project to the same workflow key; which one is
      // authoritative is `widgetStorageOf`'s decision, not iteration order's.
      out["widgets_values"] = projectWidgets(nodeType, ym, catalog);
    } else if (v instanceof Y.Array) {
      const projector = k === "outputs" ? projectOutputSlot : projectSlot;
      out[k] = v.toArray().map((slot) => projector(slot));
    } else if (v instanceof Y.Map) {
      out[k] = yMapToObject(v);
    } else {
      out[k] = structuredClone(v);
    }
  });
  return out as WorkflowNode;
}

/**
 * Structural gate for one entry of a nodes map (#13).
 *
 * ## The gate is exactly as wide as "projecting this entry would throw"
 *
 * Two conditions, and no more. An entry that is not a `Y.Map` cannot be
 * iterated by {@link projectNode}; an entry whose `widgets` slot is not a
 * `Y.Map` cannot be walked by {@link widgetsToPositional}. Everything else a
 * node can carry projects verbatim under schema §1.1's passthrough rule — a
 * `flags` that is not an object, an `inputs` that is not an array, a blank or
 * absent `type`, an `id` that disagrees with its map key. Those are odd, but
 * they are READABLE, and this function must not have an opinion about them.
 *
 * That width is the whole design, and an earlier draft of this gate got it
 * wrong in a way worth recording: it also skipped mistyped `flags`/`inputs`/
 * `outputs`, a blank `type`, and an id/key disagreement. Every one of those is
 * reachable through `mint()` and `applyOps` — `createNodeMap` stores a
 * non-plain-object `flags` as a plain clone (§1.1), and `applyAddNode` keys by
 * `op.node_id` without requiring `op.node.id` to match. So the read path
 * silently deleted nodes the write path had accepted and acknowledged. A gate
 * on the read side must never be wider than the throw it is preventing.
 *
 * ## Why these two are safe to skip, and what a skip costs
 *
 * Neither remaining condition is reachable through this package's writers:
 * `mint`/`applyAddNode` always store a `Y.Map` per node (`createNodeMap`), and
 * `widgets` is only ever set to the `Y.Map` built by `widgetsToYMap` — a
 * payload carrying its own `widgets` is refused by `createNodeMap`'s
 * reserved-key guard. So an entry reaching either branch arrived as corrupt or
 * untrusted doc state, e.g. a raw update folded in by the doc host.
 *
 * **A skipped node is gone for good, not merely hidden.** Schema §4 compaction
 * re-mints the document FROM `project(doc)`, so the next compaction writes a
 * document in which the skipped entry does not exist. Nothing warns the caller:
 * this is the deliberate read-path fail-open of #13 (one corrupt entry must not
 * make the whole document unprojectable), and its price is that recovering the
 * entry requires the pre-compaction update history. **Any widening of this gate
 * is therefore a data-deletion change, and belongs in a schema amendment.**
 * Links are projected independently, so a skipped node can leave a link tuple
 * referring to an id absent from `nodes`.
 *
 * ## Catalog-contract violations are NOT skipped
 *
 * A type with named widget values the pinned catalog does not describe, or a
 * widget name absent from `widget_order`, means the caller passed a catalog
 * other than the one the doc pins. Per KA-12 / schema §3 pin 4 that fails
 * loudly rather than silently dropping nodes: `widgetsToPositional` throws and
 * the throw propagates. As of #13's apply-time guards those states are no
 * longer reachable through this package's writers either — `applyOps` refuses
 * the write that would create them — so a throw here means catalog drift, which
 * is exactly what it should mean.
 */
function tryProjectNode(value: unknown, catalog: WidgetCatalog): WorkflowNode | null {
  if (!(value instanceof Y.Map)) return null;
  if (value.has("widgets") && !(value.get("widgets") instanceof Y.Map)) return null;
  return projectNode(value, catalog);
}

/** Definition Y.Map → subgraph definition JSON, interior nodes/links in mint order. */
function projectDefinition(dm: Y.Map<unknown>, catalog: WidgetCatalog): Record<string, unknown> {
  const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  dm.forEach((v, k) => {
    if (k === "node_order" || k === "link_order") return; // internal order registers
    if (k === "nodes" && v instanceof Y.Map) {
      const order = (dm.get("node_order") as string[] | undefined) ?? [...v.keys()].sort();
      out[k] = order
        .filter((id) => v.has(id))
        .map((id) => tryProjectNode(v.get(id), catalog))
        .filter((node): node is WorkflowNode => node !== null);
    } else if (k === "links" && v instanceof Y.Map) {
      const order = (dm.get("link_order") as string[] | undefined) ?? [...v.keys()].sort();
      out[k] = order.filter((id) => v.has(id)).map((id) => structuredClone(v.get(id)));
    } else {
      out[k] = structuredClone(v);
    }
  });
  return out;
}

/**
 * Project the doc to canonical ComfyUI workflow JSON (schema §7).
 * `catalog` MUST be the catalog the doc pins (`meta.catalog_version`) — a
 * different catalog resolves different widget positions by design (§1.2).
 *
 * FAIL-CLOSED ON SCHEMA (KA-11, #38). The very first thing this does is refuse
 * a document whose `meta.schema_version` is missing, unreadable, or not this
 * package's `SCHEMA_VERSION` — `SchemaVersionError`, before it reads any
 * workflow CONTENT. (Not "before it reads any key": reading the version claim
 * is itself a key read. The distinction matters because the claim has to be
 * read from somewhere.) `migrate()` was the only fail-closed read gate before,
 * and nothing forced a caller through it, so a document minted by a NEWER
 * package was best-effort projected by an OLDER reader as though it were
 * current: the silent mis-projection KA-11 exists to prevent.
 *
 * One documented exception to the error TYPE, carried from Amendment A3: a
 * document whose `meta` root was integrated as a different concrete Y type
 * surfaces Yjs's own constructor-clash `Error`, not a `SchemaVersionError`.
 * Still fail-closed, still a throw, but a consumer matching on the type must
 * expect it.
 *
 * This is a WHOLE-DOCUMENT refusal, and it is deliberately not the same
 * policy as `tryProjectNode`'s per-node skip above. Take the wording from §7
 * rule 6 exactly: what gets skipped is an entry that cannot be READ — not a
 * `Y.Map`, or a `widgets` slot that is not a `Y.Map`, and EXACTLY those two.
 * An "invalid" node in the looser sense (a mistyped `flags`, a blank `type`,
 * an `id` disagreeing with its key) is odd but readable and projects verbatim;
 * Amendment A4 narrowed the rule to that precisely because the wider version
 * silently deleted nodes the write path had accepted. Salvageability is the
 * axis, not severity: an unreadable entry is one bad entry in a document the
 * reader otherwise understands completely, so per-entry recovery exists. A
 * wrong schema version says the reader cannot interpret the layout AT ALL —
 * every node it went on to project would be a guess — so there is no readable
 * remainder to salvage and a skip is not even available as an option.
 */
export function project(doc: Y.Doc, catalog: WidgetCatalog): WorkflowJSON {
  assertReadableSchema(doc, "project");

  const wf: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  metaMap(doc).forEach((v, k) => {
    if (k === "schema_version" || k === "catalog_version" || k.startsWith("__")) return;
    wf[k] = structuredClone(v);
  });

  const nodes: WorkflowNode[] = [];
  nodesMap(doc).forEach((ym, id) => {
    const node = tryProjectNode(ym, catalog);
    if (node) nodes.push(node);
  });
  nodes.sort((a, b) => idCompare(a.id, b.id));
  wf["nodes"] = nodes;

  const links: unknown[] = [];
  linksMap(doc).forEach((ln) => links.push(structuredClone(ln)));
  links.sort((a, b) => idCompare((a as unknown[])[0], (b as unknown[])[0]));
  wf["links"] = links;

  const defs = definitionsMap(doc);
  const extra = metaMap(doc).get("__definitions_extra");
  if (defs.size > 0 || extra !== undefined) {
    const out: Record<string, unknown> = extra ? (structuredClone(extra) as Record<string, unknown>) : {};
    if (defs.size > 0) {
      const ids = [...defs.keys()].sort((a, b) => idCompare(a, b));
      out["subgraphs"] = ids.map((id) => projectDefinition(defs.get(id)!, catalog));
    }
    wf["definitions"] = out;
  }

  return wf as WorkflowJSON;
}
