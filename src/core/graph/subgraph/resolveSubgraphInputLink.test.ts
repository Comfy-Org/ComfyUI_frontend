import { describe, expect, test, vi } from 'vitest'

import { resolveSubgraphInputLink } from '@/core/graph/subgraph/resolveSubgraphInputLink'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

type MockInput = {
  link: number | null
  name: string
}

type MockLink = {
  resolve: () => {
    inputNode?: {
      inputs?: MockInput[]
      getWidgetFromSlot: (input: MockInput) => { name: string } | undefined
    }
  }
}

type MockNode = {
  isSubgraphNode: () => boolean
  subgraph: {
    inputNode: {
      slots: Array<{ name: string; linkIds: number[] }>
    }
    getLink: (linkId: number) => MockLink | undefined
  }
}

function asGraphNode(node: MockNode): LGraphNode {
  return node as unknown as LGraphNode
}

function createSubgraphNode(
  slots: Array<{ name: string; linkIds: number[] }>,
  links: Record<number, MockLink | undefined>
): MockNode {
  return {
    isSubgraphNode: () => true,
    subgraph: {
      inputNode: { slots },
      getLink: (linkId) => links[linkId]
    }
  }
}

describe('resolveSubgraphInputLink', () => {
  test('returns undefined for non-subgraph nodes', () => {
    const node = {
      isSubgraphNode: () => false,
      subgraph: {
        inputNode: { slots: [] },
        getLink: () => undefined
      }
    }

    const result = resolveSubgraphInputLink(
      asGraphNode(node),
      'missing',
      () => 'resolved'
    )

    expect(result).toBeUndefined()
  })

  test('returns undefined when input slot is missing', () => {
    const node = createSubgraphNode([], {})

    const result = resolveSubgraphInputLink(
      asGraphNode(node),
      'missing',
      () => 'resolved'
    )

    expect(result).toBeUndefined()
  })

  test('skips stale links where inputNode.inputs is unavailable', () => {
    const validInput: MockInput = { link: 11, name: 'seed' }
    const node = createSubgraphNode([{ name: 'prompt', linkIds: [10, 11] }], {
      10: {
        resolve: () => ({
          inputNode: {
            inputs: undefined,
            getWidgetFromSlot: () => ({ name: 'ignored' })
          }
        })
      },
      11: {
        resolve: () => ({
          inputNode: {
            inputs: [validInput],
            getWidgetFromSlot: () => ({ name: 'seed' })
          }
        })
      }
    })

    const result = resolveSubgraphInputLink(
      asGraphNode(node),
      'prompt',
      ({ targetInput }) => targetInput.name
    )

    expect(result).toBe('seed')
  })

  test('caches getTargetWidget result within the same callback evaluation', () => {
    const input: MockInput = { link: 22, name: 'model' }
    const getWidgetFromSlot = vi.fn(() => ({ name: 'modelWidget' }))

    const node = createSubgraphNode([{ name: 'model', linkIds: [22] }], {
      22: {
        resolve: () => ({
          inputNode: {
            inputs: [input],
            getWidgetFromSlot
          }
        })
      }
    })

    const result = resolveSubgraphInputLink(
      asGraphNode(node),
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
})
