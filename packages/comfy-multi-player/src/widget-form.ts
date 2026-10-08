/**
 * Node-local widget form (schema Amendment A24).
 *
 * ## The two shapes this closes
 *
 * §1.2 resolves a widget name to a projection position through the PINNED
 * CATALOG's `widget_order`. That is the right default and it has two reachable
 * holes, both of which end with a user's edit silently unavailable:
 *
 *  1. A class the catalog cannot describe has no `widget_order` and can never
 *     get one, so Amendment A2 stores its non-empty positional
 *     `widgets_values` whole under `__widgets_opaque`. That round-trips
 *     verbatim but is not name-addressable at all: `set_widget` against it is
 *     rejected `opaque_widgets`.
 *  2. A node whose serializer emits an OBJECT rather than an array (ComfyUI's
 *     custom `serialize_widgets`, e.g. the `VHS_*` family) was stored as a
 *     name-keyed map of the serializer's OWN keys and then projected back
 *     through `widget_order` as a positional ARRAY. The object shape was
 *     therefore lost, every key in it that is not a widget was dropped, and
 *     for an uncatalogued class `project()` threw for the whole document.
 *
 * Neither hole is repairable from the end state. Reading an opaque array or a
 * serializer's object tells a consumer nothing about which entry is which
 * widget, so a repair pass would be re-deriving intent from an end state —
 * the same mistake FC-8 names one op over (never re-derive an `add_node`
 * payload from a schema on replay), and exactly how a widget write lands on
 * the wrong slot.
 *
 * ## The contract
 *
 * The PRODUCER declares it, once, on the node it serialized:
 *
 * ```jsonc
 * { "id": 7, "type": "VHS_LoadVideo",
 *   "widgets_values": { "video": "clip.mp4", "videopreview": { … }, … },
 *   "widgets_values_form": { "order": ["video", "force_rate"] } }
 * ```
 *
 * `order` is the ordered identity of THIS instance's serializable widgets.
 * Duplicates are legal — that is the FE-3036 case the catalog cannot express —
 * and the occurrence of each entry is its position among equal names, exactly
 * as `widget-identity.ts` already defines it for the catalog path.
 *
 * Everything else is DERIVED here rather than declared, so there is one
 * producer obligation instead of four and no field can disagree with another:
 * the serialization shape comes from `typeof widgets_values`, the original
 * key order from `Object.keys`, and the non-widget residue from the keys
 * `order` does not name.
 *
 * ## What this deliberately does not do
 *
 * It does not add a second named representation of a widget value. The
 * identity-keyed `widgets` Y.Map stays the only place a widget value lives;
 * this module stores the LAYOUT beside it ({@link WIDGET_FORM_KEY}) and the
 * residue of keys that are not widgets at all. A `set_widget` therefore
 * remains one map `set` against one scalar register, so §1.2's positional
 * merge corruption cannot arise and the residue cannot drift from the values
 * (it never holds one).
 *
 * It does not relax KA-12. A self-described node does not consult the catalog
 * because it does not need to: the name↔position mapping arrived WITH the
 * node from the only party that knows it. KA-12 exists to stop this package
 * guessing a mapping it was never given, and a declaration is not a guess. An
 * undeclared node is unaffected — same catalog, same rejections.
 */

import type * as Y from "yjs";
import { widgetIndexOf, widgetOccurrenceAt, widgetStorageKey } from "./widget-identity.js";

/** Producer-supplied node field carrying the declaration (workflow JSON). */
export const WIDGET_FORM_FIELD = "widgets_values_form";

/**
 * Reserved per-node DOC-INTERNAL key holding the derived form. Never a
 * workflow key: `createNodeMap` refuses a payload that carries it and
 * `project()` emits {@link WIDGET_FORM_FIELD} in its place.
 */
export const WIDGET_FORM_KEY = "__widgets_form";

/** The serialization shape the producer's `widgets_values` had. */
export type WidgetFormShape = "array" | "object";

/** The derived, stored form (plain value — one whole-value LWW register). */
export interface StoredWidgetForm {
  shape: WidgetFormShape;
  /** Declared ordered widget identity; occurrence is position among equal names. */
  order: string[];
  /** `object` shape only: every own key of the original object, in its original order. */
  keys?: string[];
  /** `object` shape only: verbatim values for keys `order` does not name. Omitted when empty. */
  extra?: Record<string, unknown>;
}

/** The declaration as the producer writes it. Closed: `order` and nothing else. */
export interface WidgetValuesForm {
  order: string[];
}

function refuse(detail: string): never {
  throw new TypeError(`${WIDGET_FORM_FIELD}: ${detail}`);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Does this node payload opt into A24 at all?
 *
 * The question every pre-store catalog guard has to ask first, and it is
 * deliberately presence-only: whether the declaration is WELL-FORMED is
 * {@link parseWidgetValuesForm}'s answer, raised as a refusal rather than
 * silently reverting the node to the catalog path. A malformed declaration
 * must not be answered with a catalog verdict about a shape the producer
 * never claimed.
 */
export function declaresWidgetForm(node: unknown): boolean {
  return isPlainRecord(node) && node[WIDGET_FORM_FIELD] !== undefined;
}

/**
 * Validate a producer declaration, or return `null` when the node carries
 * none.
 *
 * Closed by design: an unrecognised key is refused rather than ignored. A
 * producer that starts emitting (say) stable ids must land with the consumer
 * that reads them, and silently dropping the field would make that
 * coordination failure invisible until a value went to the wrong widget.
 */
export function parseWidgetValuesForm(raw: unknown): WidgetValuesForm | null {
  if (raw === undefined) return null;
  if (!isPlainRecord(raw)) refuse("must be an object with an `order` array");
  const unknownKeys = Object.keys(raw).filter((key) => key !== "order");
  if (unknownKeys.length > 0) {
    refuse(`unknown key(s) ${unknownKeys.join(", ")} — the declaration is closed to {order} (schema Amendment A24)`);
  }
  const order = raw["order"];
  if (!Array.isArray(order) || order.length === 0) refuse("`order` must be a non-empty array of widget names");
  for (const [index, name] of order.entries()) {
    if (typeof name !== "string" || name.length === 0) {
      refuse(`order[${String(index)}] must be a non-empty string`);
    }
  }
  return { order: [...(order as string[])] };
}

/**
 * Derive the stored form and the per-identity widget values from a declared
 * node.
 *
 * Both shapes are checked so that the declaration and the values cannot
 * disagree, because every disagreement has a silent wrong answer available:
 *
 * - an ARRAY must be exactly as long as `order`. Shorter and a declared widget
 *   has no value; longer and a value has no identity, which is the `_extra_N`
 *   guess this field exists to replace.
 * - an OBJECT must own every name in `order`, and `order` must not repeat a
 *   name. Object keys are unique, so a repeated name cannot address two
 *   values; a missing key would leave a declared widget writable but
 *   unprojectable.
 *
 * Refusal is a `TypeError`, which `mint` surfaces directly and `add_node`
 * converts to `invalid_node_payload` — the same path `createNodeMap`'s other
 * refusals already take.
 */
export function deriveWidgetForm(
  declared: WidgetValuesForm,
  wv: unknown,
): { form: StoredWidgetForm; values: Map<string, unknown> } {
  const order = [...declared.order];
  if (Array.isArray(wv)) return deriveArrayForm(order, wv);
  if (isPlainRecord(wv)) return deriveObjectForm(order, wv);
  refuse("declared on a node whose widgets_values is neither an array nor an object");
}

function deriveArrayForm(
  order: string[],
  wv: unknown[],
): { form: StoredWidgetForm; values: Map<string, unknown> } {
  if (wv.length !== order.length) {
    const entries = wv.length === 1 ? "entry" : "entries";
    refuse(`declares ${String(order.length)} widget(s) but widgets_values has ${String(wv.length)} ${entries}`);
  }
  const values = new Map<string, unknown>();
  order.forEach((name, index) => {
    values.set(widgetStorageKey(name, widgetOccurrenceAt(order, index)), wv[index]);
  });
  return { form: { shape: "array", order }, values };
}

function deriveObjectForm(
  order: string[],
  wv: Record<string, unknown>,
): { form: StoredWidgetForm; values: Map<string, unknown> } {
  const values = new Map<string, unknown>();
  const declared = new Set<string>();
  for (const name of order) {
    if (declared.has(name)) {
      refuse(`order repeats '${name}', which an object-shaped widgets_values cannot address twice`);
    }
    declared.add(name);
    if (!Object.hasOwn(wv, name)) {
      refuse(`declares widget '${name}', which object-shaped widgets_values does not carry`);
    }
    values.set(widgetStorageKey(name, 0), wv[name]);
  }
  const keys = Object.keys(wv);
  const extra = Object.fromEntries(keys.filter((key) => !declared.has(key)).map((key) => [key, wv[key]]));
  const form: StoredWidgetForm = { shape: "object", order, keys };
  if (Object.keys(extra).length > 0) form.extra = extra;
  return { form, values };
}

/**
 * The stored form of an INTEGRATED node, or `null` when the node is not
 * self-described.
 *
 * Shape-checked on read rather than trusted: this key can also arrive as raw
 * doc state folded in by a host, and a form whose `order` is unreadable must
 * not become a silent mis-projection. An unreadable form reads as "not
 * self-described", which routes the node back through the catalog path and its
 * loud catalog refusals.
 */
export function storedWidgetFormOf(node: Y.Map<unknown>): StoredWidgetForm | null {
  const stored = node.get(WIDGET_FORM_KEY);
  if (!isPlainRecord(stored)) return null;
  const { shape, order } = stored;
  if (shape !== "array" && shape !== "object") return null;
  if (!Array.isArray(order) || order.length === 0 || order.some((name) => typeof name !== "string")) return null;
  // An `object` form whose order repeats a name is unreadable, not merely odd,
  // and the asymmetry with `array` is the whole reason this check is here:
  // object keys are unique, so `projectWidgetForm` reads every declared key at
  // occurrence 0. A duplicate would let `formDeclares` AUTHORIZE a write at
  // occurrence 1 that projection can never render — a write acknowledged and
  // then invisible, which is the exact failure A24 exists to remove. Our own
  // writers cannot produce it (`deriveObjectForm` refuses it), so this is the
  // untrusted-doc-state path: a raw update folded in by a host.
  if (shape === "object" && new Set(order as string[]).size !== order.length) return null;
  const form: StoredWidgetForm = { shape, order: order as string[] };
  if (Array.isArray(stored["keys"])) form.keys = (stored["keys"] as unknown[]).map(String);
  if (isPlainRecord(stored["extra"])) form.extra = stored["extra"];
  return form;
}

/** Is `(name, occurrence)` a widget this node declared? */
export function formDeclares(form: StoredWidgetForm, name: string, occurrence: number): boolean {
  return widgetIndexOf(form.order, name, occurrence) >= 0;
}

/**
 * The position `(name, occurrence)` occupies in the declared order, or `-1`.
 *
 * Exported so a caller holding a SECOND address for the same target — a
 * promoted host write's `promoted.value_index` (Amendment A15) — can compare
 * the two rather than silently preferring one.
 */
export function formIndexOf(form: StoredWidgetForm, name: string, occurrence: number): number {
  return widgetIndexOf(form.order, name, occurrence);
}

/**
 * Is `(name, occurrence)` the FINAL occurrence of `name` in a declared order?
 * Amendment A23's gate for the `widgets_values_named` passthrough register,
 * answered from the node's own declaration instead of the catalog.
 */
export function formFinalOccurrence(form: StoredWidgetForm, name: string, occurrence: number): boolean {
  return formDeclares(form, name, occurrence) && widgetIndexOf(form.order, name, occurrence + 1) < 0;
}

/**
 * Rebuild `widgets_values` in the shape the producer serialized, from the
 * identity-keyed values plus the stored residue. Catalog-free by
 * construction.
 *
 * The object shape is rebuilt in the ORIGINAL key order (`keys`), with each
 * declared widget taking the live value from the `widgets` map and every other
 * key taking its verbatim residue. A declared key the map has no value for
 * projects as `null`, matching the array shape and §7 rule 2's padding, rather
 * than vanishing from the object.
 */
export function projectWidgetForm(
  form: StoredWidgetForm,
  widgets: Y.Map<unknown> | undefined,
): unknown {
  const read = (name: string, occurrence: number): unknown => {
    const key = widgetStorageKey(name, occurrence);
    return widgets?.has(key) === true ? structuredClone(widgets.get(key)) : null;
  };
  if (form.shape === "array") {
    return form.order.map((name, index) => read(name, widgetOccurrenceAt(form.order, index)));
  }
  const declared = new Set(form.order);
  const extra = form.extra ?? {};
  const residue = (key: string): unknown =>
    Object.hasOwn(extra, key) ? structuredClone(extra[key]) : null;
  const keys = form.keys ?? form.order;
  return Object.fromEntries(keys.map((key) => [key, declared.has(key) ? read(key, 0) : residue(key)]));
}
