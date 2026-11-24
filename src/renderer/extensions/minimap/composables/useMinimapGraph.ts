import { watch } from 'vue'
import type { Ref } from 'vue'

import type { LGraph } from '@comfyorg/litegraph/litegraph'
import { layoutStore } from '@comfyorg/graph-state/layout/layoutStore'
import { getMinimapExecutionStates } from '@/renderer/extensions/minimap/data/minimapExecutionState'
import type { MinimapChange } from '@/renderer/extensions/minimap/types'
import { useExecutionStore } from '@/stores/executionStore'
import { useLinkStore } from '@comfyorg/graph-state/linkStore'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'

function quantise(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 8) : 0
}

function readGraphState(graph: LGraph) {
  const geometry: [string, number, number, number, number][] = []
  const nodes: [number, boolean, string, string][] = []
  const executionStates = getMinimapExecutionStates(
    useExecutionStore().nodeLocationProgressStates,
    graph.isRootGraph ? null : graph.id
  )

  for (const node of graph._nodes) {
    const [x, y] = node.pos
    const [width, height] = node.renderingSize
    geometry.push([
      node.id,
      quantise(x),
      quantise(y),
      quantise(width),
      quantise(height)
    ])
    nodes.push([
      node.mode,
      !!node.has_errors,
      node.bgcolor ?? '',
      executionStates.get(node.id) ?? ''
    ])
  }

  const groups = graph._groups.map((group) => [
    quantise(group.pos[0]),
    quantise(group.pos[1]),
    quantise(group.size[0]),
    quantise(group.size[1]),
    group.color ?? ''
  ])

  const scope = graphScopeOf(graph)
  const links: [string, number, string, number][] = []
  for (const link of useLinkStore().graphTopologies(scope)) {
    if (
      !graph.getNodeById(link.originNodeId) ||
      !graph.getNodeById(link.targetNodeId)
    )
      continue
    links.push([
      link.originNodeId,
      link.originSlot,
      link.targetNodeId,
      link.targetSlot
    ])
  }

  return {
    geometry: JSON.stringify(geometry),
    picture: JSON.stringify([nodes, groups, links]),
    nodeGeometryVersion: layoutStore.nodeGeometryVersion,
    rootGraphId: scope.rootGraphId,
    owningGraphId: scope.owningGraphId
  }
}

export function useMinimapGraph(graph: Readonly<Ref<LGraph | null>>) {
  let checkForChanges: () => MinimapChange = () => 'none'

  watch(
    graph,
    (installedGraph, _, onCleanup) => {
      if (!installedGraph) return
      let baseline: ReturnType<typeof readGraphState> | null = null
      const onConfigured = () => {
        baseline = null
      }
      installedGraph.events.addEventListener('configured', onConfigured)
      onCleanup(() => {
        installedGraph.events.removeEventListener('configured', onConfigured)
        baseline = null
        checkForChanges = () => 'none'
      })

      checkForChanges = () => {
        if (graph.value !== installedGraph) return 'none'
        const current = readGraphState(installedGraph)
        const previous = baseline
        baseline = current
        if (
          !previous ||
          current.rootGraphId !== previous.rootGraphId ||
          current.owningGraphId !== previous.owningGraphId ||
          current.nodeGeometryVersion !== previous.nodeGeometryVersion ||
          current.geometry !== previous.geometry
        )
          return 'geometry'
        return current.picture !== previous.picture ? 'picture' : 'none'
      }
    },
    { immediate: true }
  )

  return { checkForChanges: (): MinimapChange => checkForChanges() }
}
