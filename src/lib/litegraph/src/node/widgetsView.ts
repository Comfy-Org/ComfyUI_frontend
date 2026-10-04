import { shallowReactive } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { toConcreteWidget } from '@/lib/litegraph/src/widgets/widgetMap'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { reportError } from '@/platform/telemetry/reportError'
import type { RefusedWidget } from '@/types/widgetId'
import {
  dropUnrenamableDuplicateWidgets,
  isWidgetNameUnreadable
} from '@/types/widgetId'

import { createArrayMutationView } from '../infrastructure/createMutationView'
import { isNodeBindable } from '../utils/type'
import { getWidgetIds } from '../utils/widget'

/**
 * `errorType` slugs here follow `src/AGENTS.md`'s
 * `<category>_<operation>_<subject>` form.
 */
const REFUSAL_TEARDOWN_ERROR_TYPE = 'failure_tearing_down_refused_widget'

interface WidgetsViewState {
  target: IBaseWidget[]
  view: IBaseWidget[]
  present: boolean
  commit: (widgets: IBaseWidget[]) => void
}

/** Shared empty result, so the common no-refusal path allocates nothing. */
const EMPTY_REFUSAL: ReadonlySet<IBaseWidget> = new Set()

/**
 * The unresolved names already reported for a node. A kept pair survives the
 * walk, so every later commit finds it again and `reportError` has no dedupe
 * of its own. Replaced rather than added to, so a name that stops colliding
 * and later collides again is reported again.
 */
const reportedUnresolvedNames = new WeakMap<LGraphNode, Set<string>>()

const states = new WeakMap<LGraphNode, WidgetsViewState>()
const widgetsViewGetters = new WeakSet<() => IBaseWidget[] | undefined>()

/**
 * Reads a property off a widget being refused. Every read here is hostile by
 * definition, and a throw would escape after the array was spliced.
 */
function safeRead(read: () => unknown): string | undefined {
  try {
    const value = read()
    return value === undefined ? undefined : String(value)
  } catch {
    return undefined
  }
}

/** Reports a teardown step that failed, so a half-done release is visible. */
function reportTeardownFailure(node: LGraphNode, error: unknown): void {
  reportError(error, {
    errorType: REFUSAL_TEARDOWN_ERROR_TYPE,
    surface: 'graph',
    level: 'warning',
    tags: { node_type: node.type },
    context: { nodeId: String(node.id) }
  })
}

/**
 * Two bindings, because production uses both: promoted subgraph inputs hold a
 * direct `_widget` reference, and an ordinary node binds by name and resolves
 * on read. Matching only the reference finds nothing on these nodes.
 */
function inputBindsWidget(
  input: LGraphNode['inputs'][number],
  widget: IBaseWidget,
  name: string | undefined
): boolean {
  if (input._widget === widget) return true
  return name !== undefined && input.widget?.name === name
}

/** Drops the slot back-references to a widget the node has just refused. */
function clearRefusedSlotBindings(
  node: LGraphNode,
  widget: IBaseWidget,
  name: string | undefined
): void {
  for (const input of node.inputs) {
    if (!inputBindsWidget(input, widget, name)) continue
    input._widget = undefined
    input.widget = undefined
    input.pos = undefined
  }
}

/**
 * The teardown `LGraphNode.removeWidget` owes a widget it can no longer find,
 * because the refusal already took it off the array. Every step is guarded: a
 * throw here would leave the node and the store's order out of sync, and during
 * `LGraph.add` a half-attached node.
 */
function releaseRefusedWidget(
  node: LGraphNode,
  // Nullish because a hole or an explicit `undefined` in `node.widgets` is
  // refused like anything else, and matching the teardown on it would clear
  // every input whose `_widget` is unset.
  widget: IBaseWidget | undefined,
  name: string | undefined
): void {
  if (!widget) return

  try {
    clearRefusedSlotBindings(node, widget, name)
  } catch (error) {
    reportTeardownFailure(node, error)
  }

  try {
    widget.onRemove?.()
  } catch (error) {
    reportTeardownFailure(node, error)
  }

  // After `onRemove`, which may still read the value through the entry.
  try {
    widget.releaseRegisteredState?.()
  } catch (error) {
    reportTeardownFailure(node, error)
  }
}

/**
 * Enforces the unique-name invariant where `node.widgets` is committed: the
 * array is a mutation view, so `addWidget`, a raw `widgets.push`, a splice and
 * a whole-array assignment all pass through here. A widget removed here is off
 * the node before it can be rendered, and its own entry is released — it may
 * already have one, from a name it held before an extension pinned it onto
 * another widget's.
 *
 * `SubgraphNode` does **not** commit through here and keeps the pre-existing
 * behaviour: it redefines `widgets` as a computed getter over its promoted
 * widgets and overrides `addCustomWidget` to push into its own array.
 */
function refuseAmbiguousWidgets(
  node: LGraphNode,
  widgets: IBaseWidget[]
): ReadonlySet<IBaseWidget> {
  const refused = dropUnrenamableDuplicateWidgets(widgets)
  if (!refused.length) {
    reportedUnresolvedNames.delete(node)
    return EMPTY_REFUSAL
  }

  const alreadyReported = takeUnresolvedReportGate(node, refused)

  for (const finding of refused) {
    // Safe to skip before the teardown below only because a kept pair is
    // never released.
    if (alreadyReported(finding)) continue

    // A kept duplicate is still the node's widget and keeps its slot wiring.
    if (finding.removed) {
      releaseRefusedWidget(node, finding.widget, finding.name)
    }
    reportRefusal(node, finding)
  }

  return new Set(
    refused.filter(({ removed }) => removed).map(({ widget }) => widget)
  )
}

/** @returns whether a finding was already alerted on before this pass. */
function takeUnresolvedReportGate(
  node: LGraphNode,
  refused: readonly RefusedWidget<IBaseWidget>[]
): (finding: RefusedWidget<IBaseWidget>) => boolean {
  const previous = reportedUnresolvedNames.get(node)
  const unresolved = new Set(
    refused
      .filter(({ cause }) => cause === 'unresolved-duplicate')
      .map(({ name }) => String(name))
  )
  if (unresolved.size) reportedUnresolvedNames.set(node, unresolved)
  else reportedUnresolvedNames.delete(node)

  return ({ cause, name }) =>
    cause === 'unresolved-duplicate' && !!previous?.has(String(name))
}

/**
 * One alert per cause, because they are different failures: an unreadable name
 * has no duplicate to go looking for, and a kept pair has lost nothing.
 */
const REFUSAL_ALERTS: Record<
  RefusedWidget<IBaseWidget>['cause'],
  {
    errorType: string
    message: (nodeId: LGraphNode['id'], name: string | undefined) => string
  }
> = {
  'unreadable-name': {
    errorType: 'failure_reading_widget_name',
    message: (nodeId) =>
      `Refused a widget on node ${nodeId}: no widget identity can be derived from its name`
  },
  'unresolved-duplicate': {
    errorType: 'failure_resolving_widget_duplicate_name',
    message: (nodeId, name) =>
      `Kept a widget named "${name}" that node ${nodeId} already has under that name: the rename was declined rather than impossible, so the widget is left in place and the pair is unresolved for now`
  },
  'duplicate-name': {
    errorType: 'failure_renaming_widget_duplicate_name',
    message: (nodeId, name) =>
      `Refused a widget named "${name}": node ${nodeId} already has a widget of that name and the duplicate cannot be renamed`
  }
}

function reportRefusal(
  node: LGraphNode,
  { widget, cause, name }: RefusedWidget<IBaseWidget>
): void {
  const alert = REFUSAL_ALERTS[cause]
  reportError(new Error(alert.message(node.id, name)), {
    errorType: alert.errorType,
    surface: 'graph',
    level: 'warning',
    tags: { node_type: node.type },
    context: {
      nodeId: String(node.id),
      widgetName: name,
      widgetType: safeRead(() => widget.type)
    }
  })
}

/**
 * Whether {@link node} still exposes this module's mutation view, and so is
 * subject to the invariant at all. `SubgraphNode` rebuilds `widgets` on every
 * read, so on a promoted list a widget's absence means nothing.
 */
function commitsThroughWidgetsView(node: LGraphNode): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(node, 'widgets')
  return !!descriptor?.get && widgetsViewGetters.has(descriptor.get)
}

/**
 * Whether {@link node} refused {@link widget} — it is not on a node whose list
 * this module owns, so it was dropped for a name it could not be given.
 */
export function wasWidgetRefused(
  node: LGraphNode,
  widget: IBaseWidget
): boolean {
  return commitsThroughWidgetsView(node) && !node.widgets?.includes(widget)
}

/**
 * The second enforcement point: a node joining a graph. `LGraph.add` normalizes
 * the view while `node.graph` is unset, so that commit mints no `WidgetId` and
 * does not enforce.
 *
 * Gated on the node still owning its widgets list, because a refusal on
 * `SubgraphNode`'s rebuilt array splices a throwaway copy while still reporting
 * and tearing down a widget that is still there. Two promoted inputs sharing an
 * inner widget name reach that state.
 */
export function refuseAmbiguousNodeWidgets(node: LGraphNode): void {
  if (!commitsThroughWidgetsView(node)) return
  // This module's own array, never `node.widgets`. That getter hands back the
  // mutation view, and the walk's closing splice on the view re-enters
  // `syncWidgetOrder` — a whole nested commit, run while the refused widget's
  // slot back-references are still live and before anything is reported.
  const widgets = states.get(node)?.target
  if (!widgets?.length) return
  refuseAmbiguousWidgets(node, widgets)
}

function syncWidgetOrder(node: LGraphNode, widgets: IBaseWidget[]): void {
  node._widgetSlotsDirty = true
  const graphId = node.graph?.rootGraph.id

  // `BaseWidget`'s constructor reads the source object's `name`, so a raw push
  // whose accessor throws would throw out of this commit and every later one,
  // wedging the node with a stale store order. Leave it unconverted for the
  // refusal below instead.
  const concreteWidgets = widgets.map((widget) => {
    // Before the conversion, not inside the catch: a hostile getter asked
    // twice can answer differently.
    const unreadable = isWidgetNameUnreadable(widget)
    try {
      return toConcreteWidget(widget, node)
    } catch (error) {
      // Only the unreadable-name case is swallowed, and only because the
      // refusal below is about to take this widget anyway. Conversion reads
      // `type`, `options` and `value` too, and a failure in any of those
      // leaves a widget the refusal has no reason to drop — so it keeps
      // throwing, as it did before. This also only covers the commit path:
      // `addCustomWidget` converts before it pushes, so `addWidget` and
      // `addDOMWidget` still throw to their caller.
      if (!unreadable) throw error
      return widget
    }
  })
  for (const [index, widget] of concreteWidgets.entries()) {
    widgets[index] = widget
  }

  // No graph, no identity to collide over yet — and renaming earlier changes
  // names that node construction still matches on.
  if (!graphId) return

  // After normalization: `toConcreteWidget` merges the class's writable `name`
  // accessor over a plain object's pinned one, so a widget judged unrenamable
  // while still raw renames cleanly a line later.
  const refused = refuseAmbiguousWidgets(node, widgets)

  for (const widget of concreteWidgets) {
    // By set, not `widgets.includes`: this runs on every commit, so a linear
    // scan here is cubic over building a node.
    if (!refused.has(widget) && isNodeBindable(widget)) {
      widget.setNodeId(node.id)
    }
  }

  useWidgetValueStore().replaceNodeWidgetOrder(
    graphId,
    node.id,
    getWidgetIds(widgets)
  )
}

function defineWidgetsView(node: LGraphNode, state: WidgetsViewState): void {
  const getWidgets = () => (state.present ? state.view : undefined)
  widgetsViewGetters.add(getWidgets)
  Object.defineProperty(node, 'widgets', {
    get: getWidgets,
    set: (value: IBaseWidget[] | undefined) => {
      if (value === undefined) {
        if (!state.present) return
        state.present = false
        state.target.splice(0)
        state.commit(state.target)
        return
      }

      state.present = true
      state.view.splice(0, state.view.length, ...value)
    },
    configurable: true,
    enumerable: true
  })
}

export function initializeWidgetsView(node: LGraphNode): void {
  const target = shallowReactive<IBaseWidget[]>([])
  const commit = (widgets: IBaseWidget[]) => syncWidgetOrder(node, widgets)
  const state: WidgetsViewState = {
    target,
    view: createArrayMutationView(target, () => commit(target)),
    present: false,
    commit
  }
  states.set(node, state)
  defineWidgetsView(node, state)
}

export function normalizeWidgetsView(node: LGraphNode): void {
  const descriptor = Object.getOwnPropertyDescriptor(node, 'widgets')
  const state = states.get(node)
  if (!state || !descriptor) return

  if (!('value' in descriptor)) {
    if (!descriptor.get || !widgetsViewGetters.has(descriptor.get)) return
    state.commit(state.target)
    return
  }

  const widgets = node.widgets
  defineWidgetsView(node, state)
  node.widgets = widgets
}
