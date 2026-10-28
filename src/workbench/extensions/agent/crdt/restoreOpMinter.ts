/**
 * Mints an undo/redo restore into the bound document. The ChangeTracker
 * replays history through `app.loadGraphData`, which litegraph runs under the
 * `load` intent source, so `docOpMinter` sees nothing of it and the document
 * keeps the state the human just undid; the next remote frame then puts it
 * back on the canvas (QAF-51).
 *
 * While the tracker is `_restoringState`, the graph is snapshotted at the
 * extension's `beforeLoadGraph` and `afterConfigureGraph` hooks and the
 * difference is expressed as semantic ops: node deletions with the links they
 * severed, node additions, changed values of widget keys present after the
 * restore, and link additions. Removed widget keys and standalone link
 * removals have no wire op; a standalone removal is surfaced, not dropped
 * silently (FE-2229).
 */
import type { WorkflowNode } from '@comfyorg/comfy-multi-player'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LLink } from '@/lib/litegraph/src/LLink'

import { docInputIndex, wireNodeSnapshot } from './docOpMinter'
import type { GraphOperation } from './graphOperations'

export interface RestoreOpMinterDeps {
  isEnabled(): boolean
  isDocBound(): boolean
  enqueue(operations: GraphOperation[]): void
  /** The live root graph, or null when no workflow is open. */
  getGraph(): LGraph | null
  /** True while the active workflow's ChangeTracker replays an undo/redo. */
  isRestoringState(): boolean
  /** Input names in the bound document's stable order. */
  docInputNames(nodeId: string): readonly (string | undefined)[] | null
}

export interface RestoreOpMinter {
  detach(): void
}

interface RestoreSnapshot {
  nodes: Map<string, WorkflowNode>
  links: Map<string, LLink>
  /**
   * Nodes present in the graph whose `serialize()` threw. Absence from `nodes`
   * otherwise reads as "not in the graph", which the diff would turn into an
   * addition or a deletion of a node that is still on the canvas.
   */
  unserializableNodeIds: string[]
}

interface RestoreListener {
  onBeforeGraphLoad(): void
  onAfterGraphConfigure(): void
  onGraphLoadError(): void
}

const activeMinters = new Set<RestoreListener>()

export function notifyRestoreMintersBeforeGraphLoad(): void {
  for (const minter of activeMinters) minter.onBeforeGraphLoad()
}

export function notifyRestoreMintersAfterGraphConfigure(): void {
  for (const minter of activeMinters) minter.onAfterGraphConfigure()
}

export function notifyRestoreMintersGraphLoadError(): void {
  for (const minter of activeMinters) minter.onGraphLoadError()
}

function snapshotGraph(graph: LGraph): RestoreSnapshot {
  const nodes = new Map<string, WorkflowNode>()
  const unserializableNodeIds: string[] = []
  for (const node of graph._nodes) {
    const serialized = wireNodeSnapshot(node)
    if (serialized) nodes.set(String(node.id), serialized)
    else unserializableNodeIds.push(String(node.id))
  }
  const links = new Map<string, LLink>()
  for (const link of graph.links.values()) links.set(String(link.id), link)
  return { nodes, links, unserializableNodeIds }
}

function widgetValuesOf(node: WorkflowNode): Record<string, unknown> {
  const values = node.widgets_values
  return values != null && typeof values === 'object' && !Array.isArray(values)
    ? values
    : {}
}

function removedNodeOperations(
  before: RestoreSnapshot,
  after: RestoreSnapshot
): GraphOperation[] {
  return [...before.nodes.keys()].flatMap((id) => {
    if (after.nodes.has(id)) return []
    const removedLinks = [...before.links.values()]
      .filter(
        (link) => String(link.origin_id) === id || String(link.target_id) === id
      )
      .map((link) => link.id)
    return [{ op: 'delete_node', node_id: id, removed_links: removedLinks }]
  })
}

function addedNodeOperations(
  before: RestoreSnapshot,
  after: RestoreSnapshot
): GraphOperation[] {
  return [...after.nodes].flatMap(([id, node]) =>
    before.nodes.has(id)
      ? []
      : [
          {
            op: 'add_node',
            node_id: id,
            class_type: node.type,
            pos: Array.isArray(node.pos) ? node.pos : [0, 0],
            node
          }
        ]
  )
}

function changedWidgetOperations(
  before: RestoreSnapshot,
  after: RestoreSnapshot
): GraphOperation[] {
  return [...after.nodes].flatMap(([id, node]) => {
    const previous = before.nodes.get(id)
    if (!previous) return []
    const oldValues = widgetValuesOf(previous)
    return Object.entries(widgetValuesOf(node)).flatMap(([name, value]) => {
      const old = oldValues[name]
      return JSON.stringify(old) === JSON.stringify(value)
        ? []
        : [{ op: 'set_widget', node_id: id, widget: name, value, old }]
    })
  })
}

function addedLinkOperations(
  before: RestoreSnapshot,
  after: RestoreSnapshot,
  deps: RestoreOpMinterDeps
): GraphOperation[] {
  return [...after.links].flatMap(([id, link]) => {
    if (before.links.has(id)) return []
    const targetId = String(link.target_id)
    const targetAdded = !before.nodes.has(targetId)
    const serializedInput =
      after.nodes.get(targetId)?.inputs?.[link.target_slot]
    const input =
      serializedInput &&
      typeof serializedInput === 'object' &&
      'name' in serializedInput &&
      typeof serializedInput.name === 'string'
        ? { name: serializedInput.name }
        : undefined
    const toSlot = targetAdded
      ? link.target_slot
      : docInputIndex(deps.docInputNames(targetId), input, link.target_slot)
    if (toSlot === undefined) return []
    return [
      {
        op: 'connect',
        link_id: link.id,
        from_node: link.origin_id,
        from_slot: link.origin_slot,
        to_node: link.target_id,
        to_slot: toSlot,
        link_type: String(link.type)
      }
    ]
  })
}

function reportDetachedLinks(
  before: RestoreSnapshot,
  after: RestoreSnapshot
): void {
  for (const [id, link] of before.links) {
    if (after.links.has(id)) continue
    const endpointRemoved =
      !after.nodes.has(String(link.origin_id)) ||
      !after.nodes.has(String(link.target_id))
    if (!endpointRemoved) {
      console.error(
        '[agent-crdt] undo/redo restore removed link without its node; doc may diverge',
        id
      )
    }
  }
}

/**
 * An incomplete snapshot is not a smaller graph: a node that threw only after
 * the restore would read as deleted and mint `delete_node` for a node still on
 * the canvas (and the mirror case a duplicate `add_node`). Serialization
 * failure has no op either, so the whole diff is skipped loudly.
 */
function diffRestore(
  before: RestoreSnapshot,
  after: RestoreSnapshot,
  deps: RestoreOpMinterDeps
): GraphOperation[] {
  const unserializable = [
    ...new Set([
      ...before.unserializableNodeIds,
      ...after.unserializableNodeIds
    ])
  ]
  if (unserializable.length > 0) {
    console.error(
      '[agent-crdt] undo/redo restore snapshot could not serialize every present node; skipping the restore diff so the doc is not told a still-present node was deleted',
      unserializable
    )
    return []
  }
  reportDetachedLinks(before, after)
  return [
    ...removedNodeOperations(before, after),
    ...addedNodeOperations(before, after),
    ...changedWidgetOperations(before, after),
    ...addedLinkOperations(before, after, deps)
  ]
}

export function attachRestoreOpMinter(
  deps: RestoreOpMinterDeps
): RestoreOpMinter {
  let restoreSnapshot: RestoreSnapshot | null = null

  const listener: RestoreListener = {
    onBeforeGraphLoad() {
      restoreSnapshot = null
      if (!deps.isRestoringState() || !deps.isEnabled() || !deps.isDocBound())
        return
      const graph = deps.getGraph()
      if (graph) restoreSnapshot = snapshotGraph(graph)
    },
    onAfterGraphConfigure() {
      const before = restoreSnapshot
      restoreSnapshot = null
      if (!before) return
      const graph = deps.getGraph()
      if (!graph) return
      const operations = diffRestore(before, snapshotGraph(graph), deps)
      if (operations.length > 0) deps.enqueue(operations)
    },
    onGraphLoadError() {
      restoreSnapshot = null
    }
  }
  activeMinters.add(listener)

  return {
    detach() {
      activeMinters.delete(listener)
      restoreSnapshot = null
    }
  }
}
