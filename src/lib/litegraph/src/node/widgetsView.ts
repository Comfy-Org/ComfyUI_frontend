import { shallowReactive } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { toConcreteWidget } from '@/lib/litegraph/src/widgets/widgetMap'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { reportError } from '@/platform/telemetry/reportError'
import {
  dropUnrenamableDuplicateWidgets,
  isWidgetNameUnreadable
} from '@/types/widgetId'

import { createArrayMutationView } from '../infrastructure/createMutationView'
import { isNodeBindable } from '../utils/type'
import { getWidgetIds } from '../utils/widget'

/**
 * Stable `errorType` for the one state that breaks widget identity: a node
 * holding two widgets under one name that could not be renamed apart, so the
 * second is refused. Alerting is keyed on this string — treat it as a
 * contract, not an implementation detail.
 * See {@link dropUnrenamableDuplicateWidgets}.
 */
const DUPLICATE_WIDGET_NAME_ERROR_TYPE = 'widget_duplicate_name_refused'

/**
 * Stable `errorType` for the other refusable state: a widget whose `name`
 * accessor throws, so no `WidgetId` can be derived for it and no duplicate is
 * involved. Separate from {@link DUPLICATE_WIDGET_NAME_ERROR_TYPE} because the
 * two need different alerts — and because collapsing them reports a collision
 * that does not exist. Also a contract, not an implementation detail.
 */
const UNREADABLE_WIDGET_NAME_ERROR_TYPE = 'widget_unreadable_name_refused'

/**
 * Stable `errorType` for a refused widget whose own teardown threw, which
 * leaves its release half-done. Also a contract, not an implementation detail.
 */
const REFUSED_WIDGET_TEARDOWN_ERROR_TYPE = 'widget_refusal_teardown_failed'

interface WidgetsViewState {
  target: IBaseWidget[]
  view: IBaseWidget[]
  present: boolean
  commit: (widgets: IBaseWidget[]) => void
}

/** Shared empty result, so the common no-refusal path allocates nothing. */
const EMPTY_REFUSAL: ReadonlySet<IBaseWidget> = new Set()

const states = new WeakMap<LGraphNode, WidgetsViewState>()
const widgetsViewGetters = new WeakSet<() => IBaseWidget[] | undefined>()

/**
 * Reads a property off a widget that is being refused. The widget reached that
 * state because an accessor misbehaved, so every read here is hostile: a
 * `name` getter that throws would escape `syncWidgetOrder` after the array has
 * already been spliced, leaving the node and the store's order out of sync.
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
    errorType: REFUSED_WIDGET_TEARDOWN_ERROR_TYPE,
    surface: 'graph',
    level: 'warning',
    tags: { node_type: node.type },
    context: { nodeId: String(node.id) }
  })
}

/**
 * Whether {@link input} is bound to the widget being released.
 *
 * Two bindings, because production uses both: `_widget` holds a direct
 * reference (promoted subgraph inputs), while an ordinary node binds its widget
 * inputs by name and resolves them on read. Matching only the reference finds
 * nothing on the nodes this refusal actually runs for, and the slot then
 * re-binds to whichever widget kept the name.
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
 * Releases a widget the node has just refused. It is already off the array, so
 * `LGraphNode.removeWidget` can no longer find it and the teardown that method
 * owns has to happen here: slot back-references would otherwise keep pointing
 * at a widget the node no longer has.
 *
 * Both steps are guarded and reported rather than thrown. This runs after the
 * array has been spliced, so a throw escaping here would leave the node and the
 * store's order out of sync — and during `LGraph.add`, a half-attached node.
 *
 * The widget's store entry is deliberately *not* deleted. A refused widget's
 * name is by definition the one another widget kept, so `widget.widgetId` now
 * resolves to that widget's entry — deleting it would destroy the value of the
 * widget this invariant exists to protect.
 */
function releaseRefusedWidget(
  node: LGraphNode,
  // Typed to admit the nullish case the type system says cannot happen: a hole
  // or an explicit `undefined` in `node.widgets` reaches the walk as an
  // unreadable name and is refused like anything else. Matching the teardown on
  // it would clear every input whose `_widget` is still unset, which is nearly
  // all of them.
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
}

/**
 * Enforces the unique-name invariant where `node.widgets` is committed: the
 * array is a mutation view, so `addWidget`, a raw `widgets.push`, a splice and
 * a whole-array assignment all pass through here. A widget refused here is
 * never registered with the store and never rendered, because it is off the
 * node before either happens.
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
  if (!refused.length) return EMPTY_REFUSAL

  for (const { widget, cause, name } of refused) {
    // The two causes are different failures and are alerted on separately: an
    // unreadable name has no duplicate at all, so reporting one would send
    // whoever reads the alert looking for a collision that does not exist.
    //
    // Both the cause and the name come from the walk, never from another read
    // of the accessor. It is hostile by definition, it need not answer twice
    // the same way, and the walk may have written to it up to four times
    // before giving up — so a re-read can name a candidate no widget holds.
    const unreadable = cause === 'unreadable-name'
    releaseRefusedWidget(node, widget, name)
    reportError(
      new Error(
        unreadable
          ? // Deliberately not "the accessor threw": a name that will not
            // coerce or will not percent-encode reads perfectly and still
            // yields no id.
            `Refused a widget on node ${node.id}: no widget identity can be derived from its name`
          : `Refused a widget named "${name}": node ${node.id} already has a widget of that name and the duplicate cannot be renamed`
      ),
      {
        errorType: unreadable
          ? UNREADABLE_WIDGET_NAME_ERROR_TYPE
          : DUPLICATE_WIDGET_NAME_ERROR_TYPE,
        surface: 'graph',
        level: 'warning',
        tags: { node_type: node.type },
        context: {
          nodeId: String(node.id),
          widgetName: name,
          widgetType: safeRead(() => widget.type)
        }
      }
    )
  }

  return new Set(refused.map(({ widget }) => widget))
}

/**
 * Whether {@link node} still exposes the mutation view this module installed,
 * and so is subject to the unique-name invariant at all.
 *
 * `SubgraphNode` replaces `widgets` with its own computed getter over promoted
 * widgets, which never commits through here. Distinguishing the two matters to
 * callers that infer refusal from a widget's absence: on a promoted list the
 * object handed in is not the object read back, so absence means nothing.
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
 * Enforces the invariant for a node that is joining a graph.
 *
 * `LGraph.add` normalizes the widgets view while `node.graph` is still unset,
 * so that commit cannot mint a `WidgetId` and deliberately does not enforce.
 * This runs where identities actually come into existence — immediately before
 * the node's widgets are registered — which is the first point at which an
 * ambiguous pair can do any harm.
 *
 * Only for a node whose widgets list this module owns. `SubgraphNode`'s getter
 * rebuilds the array on every read, so a refusal there splices a throwaway copy
 * and nothing leaves the node — while the caller still reports
 * `widget_duplicate_name_refused` and tears down the slot back-references of a
 * widget that is still there. Two promoted inputs carrying the same inner
 * widget name reach exactly that state, so the guard is load-bearing rather
 * than defensive.
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

  // `BaseWidget`'s constructor reads the source object's `name`, so converting
  // a raw push whose accessor throws throws out of this commit — and out of
  // every later one, wedging the node with a stale store order. That is the
  // exact state `UNREADABLE_NAME` exists to contain, so leave the object
  // unconverted and let the refusal below take it.
  const concreteWidgets = widgets.map((widget) => {
    // Decided before the conversion, not inside the catch. Probing the
    // accessor after it has already thrown asks a hostile getter the same
    // question twice and acts on whichever answer comes back second.
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

  // Nothing is registered until the node is in a graph, so there is no
  // identity to collide over yet — and renaming earlier than the store needs
  // it changes names that node construction still matches on. Enforcement
  // belongs at the first commit that can actually mint a `WidgetId`.
  if (!graphId) return

  // After normalization, not before: `toConcreteWidget` merges the concrete
  // class's writable `name` accessor over a plain object's pinned one, so a
  // widget judged unrenamable while still raw would be destroyed even though
  // it renames cleanly a line later.
  const refused = refuseAmbiguousWidgets(node, widgets)

  for (const widget of concreteWidgets) {
    // Membership by set, not by `widgets.includes`: this loop runs on every
    // commit and `node.widgets` commits once per `addWidget`, so a linear scan
    // here is quadratic per commit and cubic over building a node.
    //
    // A widget that would not convert is still raw and so not bindable; it has
    // also just been refused, so it is no longer on the node either.
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
