/**
 * {@link GraphMutator} that renders projected mutations onto the live litegraph
 * canvas (ADR-009). This is the interim implementation; when the drjkl
 * state-centralization stack lands, a `nodeDataStore`/World-command mutator
 * swaps in behind the same interface with the diff and projector unchanged.
 *
 * Dependencies are injected (no hidden singletons) so the wiring site owns the
 * `app` graph, node factory, and layout store. The class is deliberately thin
 * glue: correctness lives in the pure diff (`diffSnapshots`) and the projector
 * seam; this layer is exercised by the agent-browser / Playwright e2e harness.
 */
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode, TWidgetValue } from '@/lib/litegraph/src/litegraph'

import type {
  GraphMutation,
  GraphMutator,
  MutationBatch,
  NodeSpec
} from './graphMutations'

export interface LitegraphMutatorDeps {
  /** The active root graph, or null when no workflow is open. */
  getGraph: () => LGraph | null
  /** Node factory; defaults at the wiring site to `LiteGraph.createNode`. */
  createNode: (type: string) => LGraphNode | null
  /**
   * Renderer-owned, call-carried layout seam. The composition root binds each
   * callback to `LayoutSource.Remote`; this mutator never uses ambient source
   * state and remains independent of renderer imports.
   */
  layout: LitegraphRemoteLayout
}

interface LitegraphRemoteLayout {
  prepareNode: (
    graph: LGraph,
    node: LGraphNode,
    position: readonly [number, number]
  ) => void
  moveNode: (
    graph: LGraph,
    node: LGraphNode,
    position: readonly [number, number]
  ) => void
  detachNode: (node: LGraphNode) => void
}

export class LitegraphMutator implements GraphMutator {
  constructor(private readonly deps: LitegraphMutatorDeps) {}

  applyBatch(batch: MutationBatch): void {
    const graph = this.deps.getGraph()
    if (!graph) return

    for (const mutation of batch.mutations) this.applyOne(graph, mutation)
    graph.setDirtyCanvas(true, true)
  }

  private applyOne(graph: LGraph, mutation: GraphMutation): void {
    switch (mutation.kind) {
      case 'add_node':
        this.addNode(graph, mutation.node)
        return
      case 'remove_node': {
        const node = graph.getNodeById(mutation.id)
        if (node) {
          // LGraph.remove() performs its own detach. Detach first so its
          // delete operation carries Remote; the internal second detach is a
          // no-op because the attachment has already been removed.
          this.deps.layout.detachNode(node)
          graph.remove(node)
        }
        return
      }
      case 'move_node': {
        const node = graph.getNodeById(mutation.id)
        if (node) {
          this.deps.layout.moveNode(graph, node, mutation.pos)
        }
        return
      }
      case 'set_widget': {
        const node = graph.getNodeById(mutation.id)
        const widget = node?.widgets?.find((w) => w.name === mutation.name)
        if (widget) widget.value = mutation.value as TWidgetValue
        return
      }
      case 'connect': {
        const origin = graph.getNodeById(mutation.link.originId)
        const target = graph.getNodeById(mutation.link.targetId)
        if (origin && target)
          origin.connect(
            mutation.link.originSlot,
            target,
            mutation.link.targetSlot
          )
        return
      }
      case 'disconnect': {
        const target = graph.getNodeById(mutation.targetId)
        if (target) target.disconnectInput(mutation.targetSlot)
        return
      }
    }
  }

  private addNode(graph: LGraph, spec: NodeSpec): void {
    const node = this.deps.createNode(spec.type)
    if (!node) return
    node.id = spec.id

    // Seed the layout store before graph.add(). LGraph.add() attaches the node
    // and adopts an existing layout silently, so no Canvas-sourced create op
    // can echo this remote addition. The source is bound by the composition
    // root and carried by this call, never inferred from ambient state.
    this.deps.layout.prepareNode(graph, node, spec.pos)
    graph.add(node)
    for (const [name, value] of Object.entries(spec.widgets)) {
      const widget = node.widgets?.find((w) => w.name === name)
      if (widget) widget.value = value as TWidgetValue
    }
  }
}
