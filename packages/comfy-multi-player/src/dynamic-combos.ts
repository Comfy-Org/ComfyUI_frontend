/**
 * Selection-aware widget order for `COMFY_DYNAMICCOMBO_V3` inputs.
 *
 * A catalog entry's `widget_order` is value-blind: comfy-cli expands every
 * dynamic combo at its FIRST key. When the entry also carries
 * `dynamic_combos` (comfy-cli `nodes widget-catalog`), the order a node
 * actually has depends on its current selection, exactly as the frontend
 * builds it (`src/core/graph/widgets/dynamicWidgets.ts`): the selected
 * option's widget slots sit right after their selector, a nested selector's
 * after it. No DEFAULT is written when the selection changes: a selected
 * option's slot that no op ever wrote shows that option's DEFAULT, applied at
 * read time (`widgetLayoutForWidgets`). Any receiver-side VALUE write at
 * selection time is arrival-dependent — with two options sharing a child
 * name, the first seed to land would win (review on #240) — so the document
 * holds only values ops wrote and the projection is a pure function of it. A
 * child name several options share is therefore ONE slot. A self-described
 * ARRAY form does persist its recomputed realized ORDER (A25), but never an
 * option default. Which names a write may target does not depend on the
 * selection either (every option's slots are accepted), so no op's outcome
 * depends on its arrival order.
 *
 * An entry WITHOUT `dynamic_combos` is returned unchanged everywhere here, so
 * the value-blind behaviour (BE-9176 `_extra_N` placeholders) is untouched.
 */
import * as Y from "yjs";

import type { DynamicComboEntry, WidgetCatalogEntry } from "./types.js";
import { widgetOccurrenceAt, widgetStorageKey } from "./widget-identity.js";

type Combos = Record<string, DynamicComboEntry>;

function combosOf(entry: WidgetCatalogEntry | undefined): Combos | undefined {
  const combos = entry?.dynamic_combos;
  return combos && Object.keys(combos).length > 0 ? combos : undefined;
}

/** Whether `entry` carries dynamic-combo options, so its order depends on the selection. */
export function hasDynamicCombos(entry: WidgetCatalogEntry | undefined): boolean {
  return combosOf(entry) !== undefined;
}

/** Every name some option of some selector owns (any selection, any depth). */
export function optionOwnedWidgets(entry: WidgetCatalogEntry | undefined): Set<string> {
  const owned = new Set<string>();
  for (const combo of Object.values(combosOf(entry) ?? {})) {
    for (const option of Object.values(combo.options)) for (const name of option.widgets) owned.add(name);
  }
  return owned;
}

/**
 * The option a selector value picks: the catalog default when the node holds
 * no value yet (a fresh node), `undefined` for a value no option has — which,
 * as in the frontend and comfy-cli, contributes no sub-slots.
 */
function selectedOption(combo: DynamicComboEntry, value: unknown): DynamicComboEntry["options"][string] | undefined {
  const key = value === undefined || value === null ? combo.default : String(value);
  return key !== null && Object.hasOwn(combo.options, key) ? combo.options[key] : undefined;
}

/** A node's selection-aware order plus the read-time defaults of its selected options' slots. */
export interface WidgetLayout {
  order: string[];
  /** Selected-option slot → the default shown while no op has written it. */
  defaults: Map<string, unknown>;
}

/**
 * Expand `entry` for one selection. `valueAt(name, index)` returns the
 * selector's stored value (`undefined` when none), given its name and its
 * positional index in the order built so far; an unstored nested selector
 * falls back to its parent option's default for it, then to its own default.
 */
function expand(
  entry: WidgetCatalogEntry,
  combos: Combos,
  valueAt: (name: string, index: number, occurrence: number) => unknown,
  producerOrder: readonly string[] = entry.widget_order,
): WidgetLayout {
  const owned = optionOwnedWidgets(entry);
  const order: string[] = [];
  const defaults = new Map<string, unknown>();
  const walk = (names: readonly string[], depth: number): void => {
    for (const name of names) {
      order.push(name);
      if (depth > 32 || !Object.hasOwn(combos, name)) continue;
      const index = order.length - 1;
      const stored = valueAt(name, index, widgetOccurrenceAt(order, index));
      const option = selectedOption(combos[name]!, stored === undefined ? defaults.get(name) : stored);
      if (!option) continue;
      for (const [child, value] of Object.entries(option.defaults)) defaults.set(child, value);
      walk(option.widgets, depth + 1);
    }
  };
  // The class catalog normally owns the base order. A self-described ARRAY
  // form is the exception: its producer observed this instance's realized
  // order, so preserve that order for stable widgets and only replace the
  // catalog-owned dynamic children. This lets a selector change recompute the
  // realized order without moving unrelated producer-local widgets.
  walk(producerOrder.filter((name) => !owned.has(name)), 0);
  return { order, defaults };
}

/** The order for a workflow node's own `widgets_values` (positional array or name-keyed object). */
export function widgetOrderForValues(entry: WidgetCatalogEntry | undefined, wv: unknown): readonly string[] | undefined {
  if (!entry) return undefined;
  const combos = combosOf(entry);
  if (!combos) return entry.widget_order;
  if (Array.isArray(wv)) return expand(entry, combos, (_name, index) => wv[index]).order;
  if (typeof wv === "object" && wv !== null) {
    const named = wv as Record<string, unknown>;
    return expand(entry, combos, (name) => (Object.hasOwn(named, name) ? named[name] : undefined)).order;
  }
  return expand(entry, combos, () => undefined).order;
}

/** The layout for a document node's name-keyed widgets map: order plus read-time defaults. */
export function widgetLayoutForWidgets(entry: WidgetCatalogEntry, widgets: Y.Map<unknown> | undefined): WidgetLayout {
  const combos = combosOf(entry);
  if (!combos) return { order: entry.widget_order, defaults: new Map() };
  return expand(entry, combos, (name, _index, occurrence) =>
    widgets?.get(widgetStorageKey(name, occurrence)),
  );
}

/** The order for a document node's name-keyed widgets map. */
export function widgetOrderForWidgets(
  entry: WidgetCatalogEntry,
  widgets: Y.Map<unknown> | undefined,
): readonly string[] {
  return widgetLayoutForWidgets(entry, widgets).order;
}

/**
 * Recompute a self-described ARRAY form's realized order after a selector
 * write wins. `producerOrder` may already contain the previous selection's
 * children; {@link expand} removes every catalog-owned child before expanding
 * the selectors from their stored values, so repeated A→B→A switches remain
 * anchored to the same producer-local order.
 */
export function widgetOrderForProducerOrder(
  entry: WidgetCatalogEntry,
  producerOrder: readonly string[],
  widgets: Y.Map<unknown> | undefined,
): readonly string[] {
  const combos = combosOf(entry);
  if (!combos) return [...producerOrder];
  return expand(
    entry,
    combos,
    (name, _index, occurrence) => widgets?.get(widgetStorageKey(name, occurrence)),
    producerOrder,
  ).order;
}

/**
 * The node's projected `widgets_values` length: one past the highest slot
 * that holds a stored value OR shows a read-time default.
 */
export function projectedLength(layout: WidgetLayout, widgets: Y.Map<unknown> | undefined): number {
  let max = -1;
  layout.order.forEach((name, index) => {
    if (
      widgets?.has(widgetStorageKey(name, widgetOccurrenceAt(layout.order, index))) ||
      layout.defaults.has(name)
    ) max = Math.max(max, index);
  });
  return max + 1;
}
