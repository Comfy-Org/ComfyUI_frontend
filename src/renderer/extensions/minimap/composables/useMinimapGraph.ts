import { watch } from 'vue'
import type { Ref } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { MinimapChange } from '@/renderer/extensions/minimap/types'
import { useExecutionStore } from '@/stores/executionStore'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

function quantise(value: number): number {
  return Math.round(value * 8)
}

function mixIn(digest: number, value: number): number {
  return (Math.imul(digest, 31) + (Number.isFinite(value) ? value : 0)) | 0
}

function mixString(digest: number, value: string): number {
  digest = mixIn(digest, value.length)
  for (let i = 0; i < value.length; i++) {
    digest = mixIn(digest, value.charCodeAt(i))
  }
  return digest
}

function computeGraphDigests(graph: LGraph) {
  let geometry = mixIn(layoutStore.nodeGeometryVersion, graph._nodes.length)
  let picture = graph._groups.length
  const progressStates = useExecutionStore().nodeLocationProgressStates
  const containingSubgraphId = graph.isRootGraph ? null : graph.id

  for (const node of graph._nodes) {
    const [x, y] = node.pos
    const [width, height] = node.renderingSize
    geometry = mixString(geometry, node.id)
    geometry = mixIn(geometry, quantise(x))
    geometry = mixIn(geometry, quantise(y))
    geometry = mixIn(geometry, quantise(width))
    geometry = mixIn(geometry, quantise(height))
    picture = mixIn(picture, node.mode)
    picture = mixIn(picture, node.has_errors ? 1 : 0)
    picture = mixString(picture, node.bgcolor ?? '')
    const locatorId = createNodeLocatorId(containingSubgraphId, node.id)
    const state = Object.hasOwn(progressStates, locatorId)
      ? progressStates[locatorId].state
      : ''
    picture = mixString(picture, state)
  }

  for (const group of graph._groups) {
    picture = mixIn(picture, quantise(group.pos[0]))
    picture = mixIn(picture, quantise(group.pos[1]))
    picture = mixIn(picture, quantise(group.size[0]))
    picture = mixIn(picture, quantise(group.size[1]))
    picture = mixString(picture, group.color ?? '')
  }

  const scope = graphScopeOf(graph)
  let linkCount = 0
  for (const link of useLinkStore().graphTopologies(scope)) {
    if (
      !graph.getNodeById(link.originNodeId) ||
      !graph.getNodeById(link.targetNodeId)
    )
      continue
    linkCount++
    picture = mixString(picture, link.originNodeId)
    picture = mixString(picture, link.targetNodeId)
    picture = mixIn(picture, link.originSlot)
    picture = mixIn(picture, link.targetSlot)
  }
  picture = mixIn(picture, linkCount)

  return {
    geometry,
    picture,
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
      let baseline: ReturnType<typeof computeGraphDigests> | null = null
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
        const current = computeGraphDigests(installedGraph)
        const previous = baseline
        baseline = current
        if (
          !previous ||
          current.rootGraphId !== previous.rootGraphId ||
          current.owningGraphId !== previous.owningGraphId ||
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
