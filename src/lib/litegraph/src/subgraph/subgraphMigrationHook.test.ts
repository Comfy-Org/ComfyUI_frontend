import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import {
  runSubgraphMigrationFlushHook,
  setSubgraphMigrationFlushHook
} from './subgraphMigrationHook'

describe('subgraph migration hook registry', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  afterEach(() => {
    setSubgraphMigrationFlushHook(undefined)
    vi.restoreAllMocks()
  })

  it('warns in tests when legacy proxyWidgets exist but no flush hook is wired', () => {
    const hostNode = createTestSubgraphNode(createTestSubgraph())
    hostNode.properties.proxyWidgets = [['1', 'seed']]
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    runSubgraphMigrationFlushHook(hostNode, undefined)

    expect(warnSpy).toHaveBeenCalledWith(
      '[SubgraphNode] Legacy proxyWidgets were not migrated because no migration flush hook is wired',
      expect.objectContaining({
        hostNodeId: hostNode.id,
        proxyWidgets: [['1', 'seed']]
      })
    )
  })

  it('uses the wired flush hook instead of warning', () => {
    const hostNode = createTestSubgraphNode(createTestSubgraph())
    hostNode.properties.proxyWidgets = [['1', 'seed']]
    const hook = vi.fn()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setSubgraphMigrationFlushHook(hook)

    runSubgraphMigrationFlushHook(hostNode, undefined)

    expect(hook).toHaveBeenCalledWith({ hostNode, nodeData: undefined })
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
