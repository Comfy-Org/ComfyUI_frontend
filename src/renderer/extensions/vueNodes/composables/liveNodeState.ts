import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import type { NodeId } from '@/renderer/core/layout/types'

/**
 * Node types kept out of viewport culling entirely, for state this module
 * cannot detect from the DOM.
 *
 * A registry rather than a node property. `LGraphNode.serialize` clones
 * `properties` wholesale, so an opt-out stored there becomes permanent
 * workflow JSON the first time anyone sets it - a renderer-internal hint
 * travelling to other users and other frontend versions, on a path graded R3
 * `workflow-serialization`. Nothing consumes the opt-out yet, so this is the
 * cheap moment to keep it internal; publishing it later is additive, and
 * un-publishing it would not be.
 */
const NODE_TYPES_EXCLUDED_FROM_CULLING = new Set<string>()

/**
 * Elements whose live state a re-render cannot reproduce.
 *
 * Deliberately not "every node with a legacy DOM widget": in the standard
 * 245-node fixture that is 40% of nodes, all of them CLIPTextEncode prompt
 * textareas, so it would silently disable culling on ordinary workflows. A
 * textarea's value lives in widgetValueStore and survives a remount; what it
 * loses is caret, scroll and IME state, and only for the node being typed in -
 * which the focus pin already covers.
 *
 * What genuinely cannot be rebuilt is media mid-playback, a live capture
 * stream, and an iframe's document.
 */
const LIVE_STATE_SELECTOR = 'iframe, video, audio'

function isLiveElement(element: Element): boolean {
  if (element.tagName === 'IFRAME') return true

  // Media only counts while actually running; an idle <video> rebuilds from
  // its src, and pinning every node that has one would creep back towards the
  // over-broad rule this replaces. No currentTime check: playback starts at
  // zero, and a seek to zero is still playback.
  const media = element as HTMLMediaElement
  return !media.paused && !media.ended
}

/**
 * Ids of currently-mounted nodes holding state that unmounting would destroy.
 *
 * Retention-shaped by design: only a mounted node can hold live state, so this
 * scans the mounted subtree rather than the whole graph, which keeps it
 * bounded by the mounted count rather than graph size.
 */
export function findNodesWithLiveState(
  root: ParentNode = document
): Set<NodeId> {
  const ids = new Set<NodeId>()

  for (const element of root.querySelectorAll(LIVE_STATE_SELECTOR)) {
    if (!isLiveElement(element)) continue
    const id = element.closest('[data-node-id]')?.getAttribute('data-node-id')
    if (id) ids.add(id as NodeId)
  }

  return ids
}

/** Nodes excluded from culling by type; see the registry above. */
export function findNodesOptedOutOfCulling(
  nodes: readonly VueNodeData[]
): Set<NodeId> {
  const ids = new Set<NodeId>()
  if (NODE_TYPES_EXCLUDED_FROM_CULLING.size === 0) return ids

  for (const node of nodes) {
    if (NODE_TYPES_EXCLUDED_FROM_CULLING.has(node.type)) ids.add(node.id)
  }

  return ids
}
