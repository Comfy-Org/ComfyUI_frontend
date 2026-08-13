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
 *      the array length is 1 + the highest widget index present;
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
import { definitionsMap, linksMap, metaMap, nodesMap } from "./doc.js";
import type { WidgetCatalog, WorkflowJSON, WorkflowNode } from "./types.js";

/** Sorted-by-id comparator: numeric when both ids are numbers, else string order. */
function idCompare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function yMapToObject(m: Y.Map<unknown>): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
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

/** Name-keyed widgets map → positional widgets_values (§7 rule 2). */
function widgetsToPositional(
  nodeType: string,
  widgets: Y.Map<unknown>,
  catalog: WidgetCatalog,
): unknown[] {
  if (widgets.size === 0) return [];
  const entry = catalog.types[nodeType];
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

/** Per-node Y.Map → workflow node JSON. Emits exactly the keys stored at mint/apply time. */
function projectNode(ym: Y.Map<unknown>, catalog: WidgetCatalog): WorkflowNode {
  const out: Record<string, unknown> = {};
  const nodeType = String(ym.get("type") ?? "");
  ym.forEach((v, k) => {
    if (k === "widgets") {
      out["widgets_values"] = widgetsToPositional(nodeType, v as Y.Map<unknown>, catalog);
    } else if (v instanceof Y.Array) {
      out[k] = v.toArray().map((slot) => projectSlot(slot));
    } else if (v instanceof Y.Map) {
      out[k] = yMapToObject(v);
    } else {
      out[k] = structuredClone(v);
    }
  });
  return out as WorkflowNode;
}

/** Definition Y.Map → subgraph definition JSON, interior nodes/links in mint order. */
function projectDefinition(dm: Y.Map<unknown>, catalog: WidgetCatalog): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  dm.forEach((v, k) => {
    if (k === "node_order" || k === "link_order") return; // internal order registers
    if (k === "nodes" && v instanceof Y.Map) {
      const order = (dm.get("node_order") as string[] | undefined) ?? [...v.keys()].sort();
      out[k] = order
        .filter((id) => v.has(id))
        .map((id) => projectNode(v.get(id) as Y.Map<unknown>, catalog));
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
 */
export function project(doc: Y.Doc, catalog: WidgetCatalog): WorkflowJSON {
  const wf: Record<string, unknown> = {};
  metaMap(doc).forEach((v, k) => {
    if (k === "schema_version" || k === "catalog_version" || k.startsWith("__")) return;
    wf[k] = structuredClone(v);
  });

  const nodes: WorkflowNode[] = [];
  nodesMap(doc).forEach((ym) => nodes.push(projectNode(ym, catalog)));
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
