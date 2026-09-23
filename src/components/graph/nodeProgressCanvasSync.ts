import type {
  LGraph,
  LGraphCanvas,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import type { useExecutionStore } from '@/stores/executionStore'
import type { NodeLocatorId } from '@/types/nodeIdentification'

type ProgressStates = Readonly<
  ReturnType<typeof useExecutionStore>['nodeLocationProgressStates']
>
type ProgressState = ProgressStates[NodeLocatorId]

export interface NodeProgressCanvasSync {
  dispose: () => void
  sync: (
    states: ProgressStates,
    canvas: LGraphCanvas | null,
    graph: LGraph | null
  ) => void
}

function progressValue(state: ProgressState | undefined) {
  return state?.state === 'running' ? state.value / state.max : undefined
}

export function createNodeProgressCanvasSync(
  nodeToLocator: (node: LGraphNode) => NodeLocatorId
): NodeProgressCanvasSync {
  let activeCanvas: LGraphCanvas | null = null
  let activeGraph: LGraph | null = null
  let activeStates: ProgressStates = {}
  let nodeLocators = new WeakMap<LGraphNode, NodeLocatorId>()
  const nodesByLocator = new Map<NodeLocatorId, LGraphNode[]>()

  function markDirty() {
    activeCanvas?.setDirty(true, false)
  }

  function setNodeProgress(node: LGraphNode, nextProgress: number | undefined) {
    if (Object.is(node.progress, nextProgress)) return false
    node.progress = nextProgress
    return true
  }

  function addNode(node: LGraphNode) {
    const locator = nodeToLocator(node)
    nodeLocators.set(node, locator)
    const nodes = nodesByLocator.get(locator)
    if (nodes) nodes.push(node)
    else nodesByLocator.set(locator, [node])
    return locator
  }

  function removeNode(node: LGraphNode) {
    const locator = nodeLocators.get(node)
    if (!locator) return
    const nodes = nodesByLocator.get(locator)
    if (!nodes) return
    const nextNodes = nodes.filter((candidate) => candidate !== node)
    if (nextNodes.length) nodesByLocator.set(locator, nextNodes)
    else nodesByLocator.delete(locator)
    nodeLocators.delete(node)
  }

  function onNodeAdded(event: CustomEvent<{ node: LGraphNode }>) {
    const node = event.detail.node
    const locator = addNode(node)
    if (setNodeProgress(node, progressValue(activeStates[locator]))) markDirty()
  }

  function onNodeRemoved(event: CustomEvent<{ node: LGraphNode }>) {
    removeNode(event.detail.node)
  }

  function detachGraph() {
    activeGraph?.events.removeEventListener('node:added', onNodeAdded)
    activeGraph?.events.removeEventListener(
      'node:before-removed',
      onNodeRemoved
    )
  }

  function replaceGraph(graph: LGraph | null) {
    detachGraph()
    activeGraph = graph
    nodesByLocator.clear()
    nodeLocators = new WeakMap()
    if (!graph) return false

    let progressChanged = false
    for (const node of graph.nodes) {
      const locator = addNode(node)
      progressChanged =
        setNodeProgress(node, progressValue(activeStates[locator])) ||
        progressChanged
    }
    graph.events.addEventListener('node:added', onNodeAdded)
    graph.events.addEventListener('node:before-removed', onNodeRemoved)
    return progressChanged
  }

  function sync(
    states: ProgressStates,
    canvas: LGraphCanvas | null,
    graph: LGraph | null
  ) {
    const previousStates = activeStates
    activeCanvas = canvas
    activeStates = states

    if (graph !== activeGraph) {
      if (replaceGraph(graph)) markDirty()
      return
    }

    let progressChanged = false
    const changedLocators = new Set([
      ...Object.keys(previousStates),
      ...Object.keys(states)
    ] as NodeLocatorId[])
    for (const locator of changedLocators) {
      const previousProgress = progressValue(previousStates[locator])
      const nextProgress = progressValue(states[locator])
      if (Object.is(previousProgress, nextProgress)) continue
      for (const node of nodesByLocator.get(locator) ?? []) {
        progressChanged = setNodeProgress(node, nextProgress) || progressChanged
      }
    }
    if (progressChanged) markDirty()
  }

  function dispose() {
    detachGraph()
    activeCanvas = null
    activeGraph = null
    activeStates = {}
    nodesByLocator.clear()
    nodeLocators = new WeakMap()
  }

  return { dispose, sync }
}
