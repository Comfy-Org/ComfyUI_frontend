import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  computeActiveGraphIds,
  computeAncestorExecutionIds,
  createVerificationAbortController
} from './missingCandidateHelpers'

const mocks = vi.hoisted(() => ({
  getActiveGraphNodeIds: vi.fn()
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getActiveGraphNodeIds: mocks.getActiveGraphNodeIds
}))

describe('createVerificationAbortController', () => {
  it('create returns a fresh, non-aborted controller', () => {
    const manager = createVerificationAbortController()
    const controller = manager.create()
    expect(controller.signal.aborted).toBe(false)
  })

  it('create aborts the previously issued controller', () => {
    const manager = createVerificationAbortController()
    const first = manager.create()
    manager.create()
    expect(first.signal.aborted).toBe(true)
  })

  it('abort aborts the current controller', () => {
    const manager = createVerificationAbortController()
    const controller = manager.create()
    manager.abort()
    expect(controller.signal.aborted).toBe(true)
  })

  it('abort after abort is a no-op (no current controller)', () => {
    const manager = createVerificationAbortController()
    manager.create()
    manager.abort()
    expect(() => manager.abort()).not.toThrow()
  })

  it('cold abort before any create is a no-op', () => {
    const manager = createVerificationAbortController()
    expect(() => manager.abort()).not.toThrow()
  })

  it('create can be re-used after abort', () => {
    const manager = createVerificationAbortController()
    manager.create()
    manager.abort()
    const controller = manager.create()
    expect(controller.signal.aborted).toBe(false)
  })
})

describe('computeAncestorExecutionIds', () => {
  it('expands each node id into its execution-id prefixes, inclusive', () => {
    const result = computeAncestorExecutionIds(['65:70:63'])
    expect([...result]).toEqual(['65', '65:70', '65:70:63'])
  })

  it('deduplicates shared ancestor prefixes across node ids', () => {
    const result = computeAncestorExecutionIds(['65:70', '65:71'])
    expect(result).toEqual(new Set(['65', '65:70', '65:71']))
  })

  it('returns an empty set for no node ids', () => {
    expect(computeAncestorExecutionIds([]).size).toBe(0)
  })
})

describe('computeActiveGraphIds', () => {
  beforeEach(() => {
    mocks.getActiveGraphNodeIds.mockReset()
  })

  it('returns an empty set when the root graph is unavailable', () => {
    const result = computeActiveGraphIds(null, null, new Set())
    expect(result.size).toBe(0)
    expect(mocks.getActiveGraphNodeIds).not.toHaveBeenCalled()
  })

  it('delegates to getActiveGraphNodeIds with the current graph', () => {
    const rootGraph = { id: 'root' }
    const currentGraph = { id: 'current' }
    mocks.getActiveGraphNodeIds.mockReturnValue(new Set(['1']))

    const ancestors = computeAncestorExecutionIds(['65'])
    const result = computeActiveGraphIds(
      rootGraph as never,
      currentGraph as never,
      ancestors
    )

    expect(result).toEqual(new Set(['1']))
    expect(mocks.getActiveGraphNodeIds).toHaveBeenCalledWith(
      rootGraph,
      currentGraph,
      ancestors
    )
  })

  it('falls back to the root graph when no current graph is given', () => {
    const rootGraph = { id: 'root' }
    mocks.getActiveGraphNodeIds.mockReturnValue(new Set(['9']))

    const result = computeActiveGraphIds(rootGraph as never, null, new Set())

    expect(result).toEqual(new Set(['9']))
    expect(mocks.getActiveGraphNodeIds).toHaveBeenCalledWith(
      rootGraph,
      rootGraph,
      expect.any(Set)
    )
  })
})
