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
   * Runs `apply` inside a scope that marks the resulting graph→layout sync as a
   * remote/agent edit, so it is never echoed back into the shared doc (ADR-009
   * invariant: remote follower mutations must be tagged external and must not
   * round-trip). Defaults to running `apply` directly. The composition root
   * injects the concrete `layoutStore` source scope; keeping it a callback is
   * what lets this mutator stay free of `renderer/` imports (workbench must not
   * import renderer).
   */
  runRemoteScope?: (apply: () => void) => void
}

export class LitegraphMutator implements GraphMutator {
  constructor(private readonly deps: LitegraphMutatorDeps) {}

  applyBatch(batch: MutationBatch): void {
    const graph = this.deps.getGraph()
    if (!graph) return

    const apply = () => {
      for (const mutation of batch.mutations) this.applyOne(graph, mutation)
      graph.setDirtyCanvas(true, true)
    }
    if (this.deps.runRemoteScope) this.deps.runRemoteScope(apply)
    else apply()
  }

  private applyOne(graph: LGraph, mutation: GraphMutation): void {
    switch (mutation.kind) {
      case 'add_node':
        this.addNode(graph, mutation.node)
        return
      case 'remove_node': {
        const node = graph.getNodeById(mutation.id)
        if (node) graph.remove(node)
        return
      }
      case 'move_node': {
        const node = graph.getNodeById(mutation.id)
        if (node) node.pos = [mutation.pos[0], mutation.pos[1]]
        return
      }
      case 'set_widget': {
        const node = graph.getNodeById(mutation.id)
        const widget = node?.widgets?.find((w) => w.name === mutation.name)
        if (widget) widget.value = mutation.value as TWidgetValue
        return
      }
      case 'clear_widget': {
        // The doc stopped tracking this widget. Clean materialization would
        // leave it at the node-type default (addNode only overrides tracked
        // keys), so restore that default: read it off a transient node of the
        // same type, which is never added to the graph.
        const node = graph.getNodeById(mutation.id)
        const widget = node?.widgets?.find((w) => w.name === mutation.name)
        if (!node || !widget) return
        const pristine = this.deps.createNode(node.type ?? '')
        const fallback = pristine?.widgets?.find(
          (w) => w.name === mutation.name
        )
        if (fallback) widget.value = fallback.value
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
    node.pos = [spec.pos[0], spec.pos[1]]
    graph.add(node)
    for (const [name, value] of Object.entries(spec.widgets)) {
      const widget = node.widgets?.find((w) => w.name === name)
      if (widget) widget.value = value as TWidgetValue
    }
  }
}
