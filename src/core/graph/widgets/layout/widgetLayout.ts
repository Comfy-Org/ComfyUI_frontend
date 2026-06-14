import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

/**
 * Transient widget layout produced by the canvas arrange pass and read back
 * during draw and hit-testing.
 *
 * Held in a non-reactive {@link WeakMap} keyed by the widget object — a
 * frame-stable side cache, deliberately separate from the reactive value store.
 * Keeping this churning per-frame geometry out of the widget instance moves
 * widgets closer to plain data whose render state lives in a queryable cache,
 * and lets entries be released automatically when a widget is collected.
 */
export interface WidgetLayout {
  /** Y offset of the widget within its node, assigned during arrange. */
  y: number
  /** Y offset captured at draw time; hit-testing reads this. */
  last_y?: number
  /** Height computed during arrange. */
  computedHeight?: number
}

const widgetLayouts = new WeakMap<IBaseWidget, WidgetLayout>()

/** Returns the widget's layout record, creating an empty one on first access. */
export function getWidgetLayout(widget: IBaseWidget): WidgetLayout {
  let layout = widgetLayouts.get(widget)
  if (!layout) {
    layout = { y: 0 }
    widgetLayouts.set(widget, layout)
  }
  return layout
}
