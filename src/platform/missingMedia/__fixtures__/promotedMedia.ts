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
