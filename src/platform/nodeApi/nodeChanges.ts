/**
 * Watching a node you do not own change.
 *
 * rgthree's Mute/Bypass relay exists to observe *other* nodes' modes. With no
 * published signal it does two things this migration is meant to delete: a
 * `setTimeout(…, 500)` poll, and a `defineProperty(this, 'mode')` trap that
 * rewrites a core property on someone else's node.
 *
 * Deliberately NOT a per-node subscription (`node.on('changed', …)`), for two
 * reasons that both end in silent breakage:
 *
 * - **Identity does not survive.** Undo, redo, reload and re-entering a
 *   subgraph all rebuild nodes, so anything keyed by the node *object* — a
 *   WeakMap, an instance field — quietly stops firing while the pack still
 *   holds what looks like a live subscription. Ids survive all four.
 * - **Keying by id instead leaks.** A module `Map<nodeId, listeners>` is never
 *   collected: the string key outlives the node, and the listener closure
 *   usually holds pack state, elements and timers. Clearing on removal does
 *   not fix it, because removal is undoable — clear too eagerly and undo
 *   returns a node whose subscriptions are dead.
 *
 * One stream, filtered by the pack, has neither failure mode: memory is bounded
 * by the number of packs rather than by node churn, and nothing depends on an
 * object surviving. It is also the shape ADR 0003 points at — state changes as
 * events on the document rather than callbacks on objects, which is what a
 * command log needs to replicate anyway.
 *
 * The source is injected by the app layer, as with node movement. Which graph
 * is observed — root only, or the active subgraph — is a wiring decision that
 * belongs where subgraph navigation is known, not here.
 */
import { ComfyApiError } from './errors'
import type { NodeHandle } from './nodeHandle'
import type { Unsubscribe } from './widgetHandle'

/** A field the host tracks and reports. Not every property is one. */
export type TrackedProperty =
  | 'title'
  | 'mode'
  | 'color'
  | 'bgcolor'
  | 'shape'
  | 'showAdvanced'

export interface NodeChangeEvent {
  /** The node that changed. It may belong to another pack, or to none. */
  readonly node: NodeHandle
  readonly property: TrackedProperty
  readonly from: unknown
  readonly to: unknown
}

type NodeChangeSource = (
  emit: (
    nodeId: string,
    property: TrackedProperty,
    from: unknown,
    to: unknown
  ) => void
) => Unsubscribe

let source: NodeChangeSource | undefined

/** Called by the app layer, which knows which graph is being edited. */
export function provideNodeChangeSource(provider: NodeChangeSource): void {
  source = provider
}

/** Test seam. */
export function resetNodeChangeSource(): void {
  source = undefined
}

export function createNodeChangeObserver(
  handleFor: (nodeId: string) => NodeHandle | undefined
) {
  return function onNodeChanged(
    listener: (event: NodeChangeEvent) => void
  ): Unsubscribe {
    // Loud rather than a silent no-op: a capability that accepts listeners and
    // never calls them is how `onPreview` shipped broken for weeks.
    if (!source) {
      throw new ComfyApiError(
        'Node changes are unavailable: the host has not provided a source.'
      )
    }
    return source((nodeId, property, from, to) => {
      const node = handleFor(nodeId)
      // The node may have gone between the change and this fan-out.
      if (!node || node.isDeleted) return
      listener({ node, property, from, to })
    })
  }
}
