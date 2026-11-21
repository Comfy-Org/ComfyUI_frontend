/**
 * Mints an undo/redo restore into the bound document. The ChangeTracker
 * replays history through `app.loadGraphData`, which litegraph runs under the
 * `load` intent source, so `docOpMinter` sees nothing of it and the document
 * keeps the state the human just undid; the next remote frame then puts it
 * back on the canvas (QAF-51).
 *
 * While the restored workflow's tracker is `_restoringState`, the graph the
 * restore configures is snapshotted at the extension's configure hooks and the
 * difference is expressed as semantic ops: node deletions with the links they
 * severed, node additions, changed values of widget keys present after the
 * restore, and link additions. Removed widget keys and standalone link
 * removals have no wire op; a standalone removal is surfaced, not dropped
 * silently (FE-2229). A restore of the bound workflow while its document
 * cannot receive ops, such as a background tab, is held until it can.
 */
import type { WorkflowNode } from '@comfyorg/comfy-multi-player'

import { documentInputIndex } from '@/core/graph/widgets/documentSlots'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LLink } from '@/lib/litegraph/src/LLink'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { GraphConfigureContext } from '@/types/comfy'

import { wireNodeSnapshot } from './docOpMinter'
import type { GraphOperation } from './graphOperations'

export interface RestoreOpMinterDeps {
  isEnabled(): boolean
  /** The bound workflow's document can receive operations now. */
  isDocBound(): boolean
  /** Whether `workflow` is the one whose document the panel is bound to. */
  isBoundWorkflow(workflow: ComfyWorkflow): boolean
  enqueue(operations: GraphOperation[]): void
  /** Records that the bound workflow holds a restore its document has not received. */
  onUnboundLocalIntent(): void
  /** True while `workflow`'s ChangeTracker replays an undo/redo. */
  isRestoringState(workflow: ComfyWorkflow): boolean
  /** Input names in the bound document's stable order. */
  docInputNames(nodeId: string): readonly (string | undefined)[] | null
}

export interface RestoreOpMinter {
  /** Enqueues held restores once the document can receive them; drops them if the binding moved. */
  deliverHeld(): void
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
  onBeforeGraphConfigure(context: GraphConfigureContext): void
  onAfterGraphConfigure(context: GraphConfigureContext): void
  onGraphLoadError(): void
}

const activeMinters = new Set<RestoreListener>()

export function notifyRestoreMintersBeforeGraphConfigure(
  context: GraphConfigureContext
): void {
  for (const minter of activeMinters) minter.onBeforeGraphConfigure(context)
}

export function notifyRestoreMintersAfterGraphConfigure(
  context: GraphConfigureContext
): void {
  for (const minter of activeMinters) minter.onAfterGraphConfigure(context)
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
        : [{ op: 'set_widget', node_id: id, widget: name, value }]
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
      : documentInputIndex(
          deps.docInputNames(targetId),
          input,
          link.target_slot
        )
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
  let pending: {
    graph: LGraph
    workflow: ComfyWorkflow
    snapshot: RestoreSnapshot
  } | null = null
  let held: { workflow: ComfyWorkflow; operations: GraphOperation[] } | null =
    null

  function hold(workflow: ComfyWorkflow, operations: GraphOperation[]): void {
    held =
      held?.workflow === workflow
        ? { workflow, operations: [...held.operations, ...operations] }
        : { workflow, operations }
    deps.onUnboundLocalIntent()
  }

  const listener: RestoreListener = {
    onBeforeGraphConfigure({ graph, workflow }) {
      pending = null
      if (
        !workflow ||
        !deps.isRestoringState(workflow) ||
        !deps.isEnabled() ||
        !deps.isBoundWorkflow(workflow)
      )
        return
      pending = { graph, workflow, snapshot: snapshotGraph(graph) }
    },
    onAfterGraphConfigure({ graph }) {
      if (pending?.graph !== graph) return
      const { workflow, snapshot } = pending
      pending = null
      const operations = diffRestore(snapshot, snapshotGraph(graph), deps)
      if (operations.length === 0 || !deps.isBoundWorkflow(workflow)) return
      if (deps.isDocBound()) deps.enqueue(operations)
      else hold(workflow, operations)
    },
    onGraphLoadError() {
      pending = null
    }
  }
  activeMinters.add(listener)

  return {
    deliverHeld() {
      if (!held) return
      if (!deps.isBoundWorkflow(held.workflow)) {
        held = null
        return
      }
      if (!deps.isDocBound()) return
      const { operations } = held
      held = null
      deps.enqueue(operations)
    },
    detach() {
      activeMinters.delete(listener)
      pending = null
      held = null
    }
  }
}
