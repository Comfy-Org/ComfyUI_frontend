import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { resolveSubgraphInputLink } from '@/core/graph/subgraph/resolveSubgraphInputLink'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
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

function createSubgraphSetup(inputName: string): {
  subgraph: Subgraph
  subgraphNode: SubgraphNode
} {
  const subgraph = createTestSubgraph({
    inputs: [{ name: inputName, type: '*' }]
  })
  const subgraphNode = createTestSubgraphNode(subgraph, { id: 1 })
  return { subgraph, subgraphNode }
}

function addLinkedInteriorInput(
  subgraph: Subgraph,
  inputName: string,
  linkedInputName: string,
  widgetName: string
): {
  node: LGraphNode
  linkId: number
} {
  const inputSlot = subgraph.inputNode.slots.find(
    (slot) => slot.name === inputName
  )
  if (!inputSlot) throw new Error(`Missing subgraph input slot: ${inputName}`)

  const node = new LGraphNode(`Interior-${linkedInputName}`)
  const input = node.addInput(linkedInputName, '*')
  node.addWidget('text', widgetName, '', () => undefined)
  input.widget = { name: widgetName }
  subgraph.add(node)
  inputSlot.connect(input, node)

  if (input.link == null)
    throw new Error(`Expected link to be created for input ${linkedInputName}`)

  return { node, linkId: input.link }
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
  vi.clearAllMocks()
})

describe('resolveSubgraphInputLink', () => {
  test('returns undefined for non-subgraph nodes', () => {
    const node = new LGraphNode('plain-node')

    const result = resolveSubgraphInputLink(node, 'missing', () => 'resolved')

    expect(result).toBeUndefined()
  })

  test('returns undefined when input slot is missing', () => {
    const { subgraphNode } = createSubgraphSetup('existing')

    const result = resolveSubgraphInputLink(
      subgraphNode,
      'missing',
      () => 'resolved'
    )

    expect(result).toBeUndefined()
  })

  test('skips stale links where inputNode.inputs is unavailable', () => {
    const { subgraph, subgraphNode } = createSubgraphSetup('prompt')
    addLinkedInteriorInput(subgraph, 'prompt', 'seed_input', 'seed')
    const stale = addLinkedInteriorInput(
      subgraph,
      'prompt',
      'stale_input',
      'stale'
    )

    const originalGetLink = subgraph.getLink.bind(subgraph)
    vi.spyOn(subgraph, 'getLink').mockImplementation((linkId) => {
      if (typeof linkId !== 'number') return originalGetLink(linkId)
      if (linkId === stale.linkId) {
        return fromPartial<ReturnType<typeof subgraph.getLink>>({
          resolve: () => ({
            inputNode: {
              inputs: undefined,
              getWidgetFromSlot: () => ({ name: 'ignored' })
            }
          })
        })
      }

      return originalGetLink(linkId)
    })

    const result = resolveSubgraphInputLink(
      subgraphNode,
      'prompt',
      ({ targetInput }) => targetInput.name
    )

    expect(result).toBe('seed_input')
  })

  test('resolves the first connected link when multiple links exist', () => {
    const { subgraph, subgraphNode } = createSubgraphSetup('prompt')
    addLinkedInteriorInput(subgraph, 'prompt', 'first_input', 'firstWidget')
    addLinkedInteriorInput(subgraph, 'prompt', 'second_input', 'secondWidget')

    const result = resolveSubgraphInputLink(
      subgraphNode,
      'prompt',
      ({ targetInput }) => targetInput.name
    )

    // First connected wins — consistent with SubgraphNode._resolveLinkedPromotionBySubgraphInput
    expect(result).toBe('first_input')
  })

  test('caches getTargetWidget result within the same callback evaluation', () => {
    const { subgraph, subgraphNode } = createSubgraphSetup('model')
    const linked = addLinkedInteriorInput(
      subgraph,
      'model',
      'model_input',
      'modelWidget'
    )
    const getWidgetFromSlot = vi.spyOn(linked.node, 'getWidgetFromSlot')

    const result = resolveSubgraphInputLink(
      subgraphNode,
      'model',
      ({ getTargetWidget }) => {
        expect(getTargetWidget()?.name).toBe('modelWidget')
        expect(getTargetWidget()?.name).toBe('modelWidget')
        return 'ok'
      }
    )

    expect(result).toBe('ok')
    expect(getWidgetFromSlot).toHaveBeenCalledTimes(1)
  })

  test('returns first link result with 3+ links connected', () => {
    const { subgraph, subgraphNode } = createSubgraphSetup('prompt')
    addLinkedInteriorInput(subgraph, 'prompt', 'first_input', 'firstWidget')
    addLinkedInteriorInput(subgraph, 'prompt', 'second_input', 'secondWidget')
    addLinkedInteriorInput(subgraph, 'prompt', 'third_input', 'thirdWidget')

    const result = resolveSubgraphInputLink(
      subgraphNode,
      'prompt',
      ({ targetInput }) => targetInput.name
    )

    expect(result).toBe('first_input')
  })

  test('returns undefined when all links fail to resolve', () => {
    const { subgraph, subgraphNode } = createSubgraphSetup('prompt')
    addLinkedInteriorInput(subgraph, 'prompt', 'first_input', 'firstWidget')
    addLinkedInteriorInput(subgraph, 'prompt', 'second_input', 'secondWidget')

    const result = resolveSubgraphInputLink(
      subgraphNode,
      'prompt',
      () => undefined
    )

    expect(result).toBeUndefined()
  })
})
