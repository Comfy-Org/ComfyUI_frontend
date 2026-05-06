import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import {
  appendHostQuarantine,
  clearHostQuarantine,
  makeQuarantineEntry,
  readHostQuarantine
} from '@/core/graph/subgraph/migration/quarantineEntry'
import type { SerializedProxyWidgetTuple } from '@/core/schemas/promotionSchema'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

function buildHost(): SubgraphNode {
  const subgraph = createTestSubgraph()
  const hostNode = createTestSubgraphNode(subgraph)
  const graph = hostNode.graph!
  graph.add(hostNode)
  return hostNode
}

describe(makeQuarantineEntry, () => {
  it('builds an entry with attemptedAtVersion pinned to 1', () => {
    const tuple: SerializedProxyWidgetTuple = ['7', 'seed']

    const entry = makeQuarantineEntry({
      originalEntry: tuple,
      reason: 'missingSourceNode'
    })

    expect(entry).toEqual({
      originalEntry: tuple,
      reason: 'missingSourceNode',
      attemptedAtVersion: 1
    })
  })

  it('includes hostValue when provided', () => {
    const tuple: SerializedProxyWidgetTuple = ['7', 'seed']

    const entry = makeQuarantineEntry({
      originalEntry: tuple,
      reason: 'missingSourceNode',
      hostValue: 42
    })

    expect(entry.hostValue).toBe(42)
  })
})

describe('host quarantine helpers', () => {
  it('returns an empty array for an unconfigured host', () => {
    const host = buildHost()

    expect(readHostQuarantine(host)).toEqual([])
  })

  it('round-trips entries via append + read', () => {
    const host = buildHost()
    const entry = makeQuarantineEntry({
      originalEntry: ['7', 'seed'],
      reason: 'missingSourceWidget',
      hostValue: 'preserved'
    })

    appendHostQuarantine(host, [entry])

    expect(readHostQuarantine(host)).toEqual([entry])
  })

  it('deduplicates entries with identical originalEntry tuples', () => {
    const host = buildHost()
    const tuple: SerializedProxyWidgetTuple = ['7', 'seed']
    const first = makeQuarantineEntry({
      originalEntry: tuple,
      reason: 'missingSourceWidget',
      hostValue: 1
    })
    const duplicate = makeQuarantineEntry({
      originalEntry: tuple,
      reason: 'unlinkedSourceWidget',
      hostValue: 2
    })

    appendHostQuarantine(host, [first])
    appendHostQuarantine(host, [duplicate])

    const stored = readHostQuarantine(host)
    expect(stored).toHaveLength(1)
    expect(stored[0]).toEqual(first)
  })

  it('keeps entries that differ by disambiguator in the originalEntry tuple', () => {
    const host = buildHost()
    const baseEntry = makeQuarantineEntry({
      originalEntry: ['7', 'seed'],
      reason: 'missingSourceWidget'
    })
    const disambiguatedEntry = makeQuarantineEntry({
      originalEntry: ['7', 'seed', 'inner-leaf'],
      reason: 'missingSourceWidget'
    })

    appendHostQuarantine(host, [baseEntry, disambiguatedEntry])

    expect(readHostQuarantine(host)).toHaveLength(2)
  })

  it('clearHostQuarantine removes the property entirely', () => {
    const host = buildHost()
    appendHostQuarantine(host, [
      makeQuarantineEntry({
        originalEntry: ['7', 'seed'],
        reason: 'missingSourceWidget'
      })
    ])

    clearHostQuarantine(host)

    expect(host.properties.proxyWidgetErrorQuarantine).toBeUndefined()
    expect(readHostQuarantine(host)).toEqual([])
  })

  it('appendHostQuarantine is a no-op when given an empty list', () => {
    const host = buildHost()

    appendHostQuarantine(host, [])

    expect(host.properties.proxyWidgetErrorQuarantine).toBeUndefined()
  })
})
