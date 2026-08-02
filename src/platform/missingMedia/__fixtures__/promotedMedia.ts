import { vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  LGraph,
  Subgraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import * as missingMediaScan from '@/platform/missingMedia/missingMediaScan'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import { createNodeExecutionId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'

type NonEmptyIds = readonly [number, ...number[]]

const promotedMediaNodeType = 'LoadImage'

interface PromotedMediaRuntimeOptions {
  sourceIds?: NonEmptyIds
  hostIds?: NonEmptyIds
  depth?: 1 | 2
  hostValue?: string
  hostOptions?: string[]
  sourceValue?: string
  sourceOptions?: string[]
}

interface PromotedMediaBranch {
  sourceGraph: Subgraph
  sourceNode: LGraphNode
  intermediateHost?: SubgraphNode
}

export interface PromotedMediaRuntime {
  rootGraph: LGraph
  subgraph: Subgraph
  hosts: [SubgraphNode, ...SubgraphNode[]]
  sourceGraphs: [Subgraph, ...Subgraph[]]
  sourceNodes: [LGraphNode, ...LGraphNode[]]
  intermediateHosts: SubgraphNode[]
}

/**
 * Defers media candidate verification until explicitly resolved, then marks all candidates as missing.
 *
 * @returns The verification spy and a resolver that releases the deferred verification.
 */
export function deferMediaVerification() {
  let resolveVerification: (() => void) | undefined
  const verification = new Promise<void>((resolve) => {
    resolveVerification = resolve
  })
  const verifySpy = vi
    .spyOn(missingMediaScan, 'verifyMediaCandidates')
    .mockImplementation(async (candidates) => {
      await verification
      for (const candidate of candidates) candidate.isMissing = true
    })

  if (!resolveVerification) throw new Error('Expected pending verification')
  return { verifySpy, resolveVerification }
}

/**
 * Creates a missing image candidate from a promoted media host node.
 *
 * @param host - The promoted media host node containing the image value
 * @returns A missing image candidate derived from the host
 * @throws If the host has no widget or its first widget value is not a string
 */
export function createPromotedMissingMediaCandidate(
  host: LGraphNode
): MissingMediaCandidate {
  const hostWidget = host.widgets?.[0]
  if (!hostWidget) throw new Error('Expected promoted image host widget')
  if (typeof hostWidget.value !== 'string') {
    throw new Error('Expected promoted image host value')
  }

  return {
    nodeId: createNodeExecutionId([host.id]),
    nodeType: promotedMediaNodeType,
    widgetName: hostWidget.name,
    mediaType: 'image',
    name: hostWidget.value,
    isMissing: true
  }
}

/**
 * Adds a promoted media source node to a subgraph and connects it to the subgraph input.
 *
 * @param subgraph - The subgraph that receives the source node
 * @param id - The identifier assigned to the source node
 * @param value - The source node's selected image value
 * @param options - The available image values for the source node
 * @returns The added promoted media source node
 * @throws Error if the source node cannot be connected to the subgraph input
 */
function addPromotedMediaSource(
  subgraph: Subgraph,
  id: number,
  value: string,
  options: string[]
): LGraphNode {
  const sourceNode = new LGraphNode(promotedMediaNodeType)
  sourceNode.id = toNodeId(id)
  sourceNode.type = promotedMediaNodeType
  const sourceInput = sourceNode.addInput('image', 'COMBO')
  const sourceWidget = sourceNode.addWidget(
    'combo',
    'image',
    value,
    () => undefined,
    { values: [...options] }
  )
  sourceInput.widget = { name: sourceWidget.name }
  subgraph.add(sourceNode)
  const link = subgraph.inputNode.slots[0].connect(sourceInput, sourceNode)
  if (!link) throw new Error('Expected promoted image input link')
  return sourceNode
}

/**
 * Creates a configurable promoted-media test runtime with source branches and host nodes.
 *
 * @param sourceIds - Identifiers for the media source nodes.
 * @param hostIds - Identifiers for the promoted media host nodes.
 * @param depth - Graph nesting depth for the source branches.
 * @param hostValue - Value assigned to each promoted media host.
 * @param hostOptions - Available values for each promoted media host.
 * @param sourceValue - Value assigned to each media source.
 * @param sourceOptions - Available values for each media source.
 * @returns The root graph, containing subgraphs, source nodes, host nodes, and intermediate hosts.
 */
export function createPromotedMediaRuntime({
  sourceIds = [42],
  hostIds = [65],
  depth = 1,
  hostValue = 'missing-host.png',
  hostOptions,
  sourceValue = 'stale-source.png',
  sourceOptions = ['valid.png']
}: PromotedMediaRuntimeOptions = {}): PromotedMediaRuntime {
  const subgraph = createTestSubgraph({
    inputs: [{ name: 'outer_image', type: 'COMBO' }]
  })
  const rootGraph = subgraph.rootGraph

  const createBranch = (sourceId: number, index: number) => {
    if (depth === 1) {
      return {
        sourceGraph: subgraph,
        sourceNode: addPromotedMediaSource(
          subgraph,
          sourceId,
          sourceValue,
          sourceOptions
        )
      }
    }

    const sourceGraph = createTestSubgraph({
      rootGraph,
      inputs: [{ name: 'middle_image', type: 'COMBO' }]
    })
    const sourceNode = addPromotedMediaSource(
      sourceGraph,
      sourceId,
      sourceValue,
      sourceOptions
    )
    const intermediateHost = createTestSubgraphNode(sourceGraph, {
      parentGraph: subgraph,
      id: 77 + index
    })
    subgraph.add(intermediateHost)
    const link = subgraph.inputNode.slots[0].connect(
      intermediateHost.inputs[0],
      intermediateHost
    )
    if (!link) throw new Error('Expected nested promoted image input link')

    return { sourceGraph, sourceNode, intermediateHost }
  }

  const [firstSourceId, ...remainingSourceIds] = sourceIds
  const branches: [PromotedMediaBranch, ...PromotedMediaBranch[]] = [
    createBranch(firstSourceId, 0),
    ...remainingSourceIds.map((id, index) => createBranch(id, index + 1))
  ]

  const createHost = (id: number) => {
    const host = createTestSubgraphNode(subgraph, {
      parentGraph: rootGraph,
      id
    })
    rootGraph.add(host)
    const hostWidget = host.widgets[0]
    if (!hostWidget) throw new Error('Expected promoted image host widget')
    hostWidget.value = hostValue
    hostWidget.options.values = [...(hostOptions ?? sourceOptions)]
    return host
  }
  const [firstHostId, ...remainingHostIds] = hostIds
  const hosts: [SubgraphNode, ...SubgraphNode[]] = [
    createHost(firstHostId),
    ...remainingHostIds.map(createHost)
  ]
  const [firstBranch, ...remainingBranches] = branches

  return {
    rootGraph,
    subgraph,
    hosts,
    sourceGraphs: [
      firstBranch.sourceGraph,
      ...remainingBranches.map((branch) => branch.sourceGraph)
    ],
    sourceNodes: [
      firstBranch.sourceNode,
      ...remainingBranches.map((branch) => branch.sourceNode)
    ],
    intermediateHosts: branches.flatMap((branch) =>
      branch.intermediateHost ? [branch.intermediateHost] : []
    )
  }
}
