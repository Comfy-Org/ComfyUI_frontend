import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { resolveSubgraphInputTarget } from '@/core/graph/subgraph/resolveSubgraphInputTarget'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))
vi.mock('@/stores/domWidgetStore', () => ({
  useDomWidgetStore: () => ({ widgetStates: new Map() })
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

function createOuterSubgraphSetup(inputNames: string[]): {
  outerSubgraph: Subgraph
  outerSubgraphNode: SubgraphNode
} {
  const outerSubgraph = createTestSubgraph({
    inputs: inputNames.map((name) => ({ name, type: '*' }))
  })
  const outerSubgraphNode = createTestSubgraphNode(outerSubgraph, { id: 1 })
  return { outerSubgraph, outerSubgraphNode }
}

function addLinkedNestedSubgraphNode(
  outerSubgraph: Subgraph,
  inputName: string,
  linkedInputName: string,
  options: { widget?: string } = {}
): { innerSubgraphNode: SubgraphNode } {
  const innerSubgraph = createTestSubgraph({
    inputs: [{ name: linkedInputName, type: '*' }]
  })
  const innerSubgraphNode = createTestSubgraphNode(innerSubgraph, { id: 819 })
  outerSubgraph.add(innerSubgraphNode)

  const inputSlot = outerSubgraph.inputNode.slots.find(
    (slot) => slot.name === inputName
  )
  if (!inputSlot) throw new Error(`Missing subgraph input slot: ${inputName}`)

  const input = innerSubgraphNode.addInput(linkedInputName, '*')
  if (options.widget) {
    innerSubgraphNode.addWidget('number', options.widget, 0, () => undefined)
    input.widget = { name: options.widget }
  }
  inputSlot.connect(input, innerSubgraphNode)

  if (input.link == null) {
    throw new Error(`Expected link to be created for input ${linkedInputName}`)
  }

  return { innerSubgraphNode }
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  vi.clearAllMocks()
})

describe('resolveSubgraphInputTarget', () => {
  test('returns target for widget-backed input on nested SubgraphNode', () => {
    const { outerSubgraph, outerSubgraphNode } = createOuterSubgraphSetup([
      'width'
    ])
    addLinkedNestedSubgraphNode(outerSubgraph, 'width', 'width', {
      widget: 'width'
    })

    const result = resolveSubgraphInputTarget(outerSubgraphNode, 'width')

    expect(result).toMatchObject({
      nodeId: '819',
      widgetName: 'width'
    })
  })

  test('returns undefined for non-widget input on nested SubgraphNode', () => {
    const { outerSubgraph, outerSubgraphNode } = createOuterSubgraphSetup([
      'audio'
    ])
    addLinkedNestedSubgraphNode(outerSubgraph, 'audio', 'audio')

    const result = resolveSubgraphInputTarget(outerSubgraphNode, 'audio')

    expect(result).toBeUndefined()
  })

  test('resolves widget inputs but not non-widget inputs on the same nested SubgraphNode', () => {
    const { outerSubgraph, outerSubgraphNode } = createOuterSubgraphSetup([
      'width',
      'audio'
    ])
    addLinkedNestedSubgraphNode(outerSubgraph, 'width', 'width', {
      widget: 'width'
    })
    addLinkedNestedSubgraphNode(outerSubgraph, 'audio', 'audio')

    expect(
      resolveSubgraphInputTarget(outerSubgraphNode, 'width')
    ).toMatchObject({
      nodeId: '819',
      widgetName: 'width'
    })
    expect(
      resolveSubgraphInputTarget(outerSubgraphNode, 'audio')
    ).toBeUndefined()
  })

  test('returns target for widget-backed input on plain interior node', () => {
    const { outerSubgraph, outerSubgraphNode } = createOuterSubgraphSetup([
      'seed'
    ])

    const inputSlot = outerSubgraph.inputNode.slots.find(
      (slot) => slot.name === 'seed'
    )!
    const node = new LGraphNode('Interior-seed')
    node.id = 42
    const input = node.addInput('seed_input', '*')
    node.addWidget('number', 'seed', 0, () => undefined)
    input.widget = { name: 'seed' }
    outerSubgraph.add(node)
    inputSlot.connect(input, node)

    const result = resolveSubgraphInputTarget(outerSubgraphNode, 'seed')

    expect(result).toMatchObject({
      nodeId: '42',
      widgetName: 'seed'
    })
  })

  test('returns undefined for non-widget input on plain interior node', () => {
    const { outerSubgraph, outerSubgraphNode } = createOuterSubgraphSetup([
      'image'
    ])

    const inputSlot = outerSubgraph.inputNode.slots.find(
      (slot) => slot.name === 'image'
    )!
    const node = new LGraphNode('Interior-image')
    const input = node.addInput('image_input', '*')
    outerSubgraph.add(node)
    inputSlot.connect(input, node)

    const result = resolveSubgraphInputTarget(outerSubgraphNode, 'image')

    expect(result).toBeUndefined()
  })
})
