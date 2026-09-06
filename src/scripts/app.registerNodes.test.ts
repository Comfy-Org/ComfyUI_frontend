import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { app as comfyApp } from '@/scripts/app'

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({ invokeExtensionsAsync: vi.fn() })
}))

type AppInternals = {
  nodeDefsPrefetch?: Promise<Record<string, ComfyNodeDefV1> | undefined>
  vueAppReady: boolean
  startNodeDefsPrefetch: () => void
  registerNodesFromDefs: (defs: Record<string, ComfyNodeDefV1>) => Promise<void>
}

const internals = comfyApp as unknown as AppInternals

describe('ComfyApp.registerNodes prefetch reuse', () => {
  beforeEach(() => {
    internals.nodeDefsPrefetch = undefined
    internals.vueAppReady = false
    vi.spyOn(internals, 'registerNodesFromDefs').mockResolvedValue()
  })

  test('reuses a resolved prefetch without fetching again', async () => {
    const defs = { A: {} } as unknown as Record<string, ComfyNodeDefV1>
    const getNodeDefs = vi
      .spyOn(comfyApp, 'getNodeDefs')
      .mockResolvedValue({} as Record<string, ComfyNodeDefV1>)
    internals.nodeDefsPrefetch = Promise.resolve(defs)

    await comfyApp.registerNodes()

    expect(getNodeDefs).not.toHaveBeenCalled()
    expect(internals.registerNodesFromDefs).toHaveBeenCalledWith(defs)
  })

  test('refetches when the prefetch resolved undefined (failed)', async () => {
    const fresh = { B: {} } as unknown as Record<string, ComfyNodeDefV1>
    const getNodeDefs = vi
      .spyOn(comfyApp, 'getNodeDefs')
      .mockResolvedValue(fresh)
    internals.nodeDefsPrefetch = Promise.resolve(undefined)

    await comfyApp.registerNodes()

    expect(getNodeDefs).toHaveBeenCalledTimes(1)
    expect(internals.registerNodesFromDefs).toHaveBeenCalledWith(fresh)
  })

  test('fetches directly when no prefetch was set', async () => {
    const fresh = { C: {} } as unknown as Record<string, ComfyNodeDefV1>
    const getNodeDefs = vi
      .spyOn(comfyApp, 'getNodeDefs')
      .mockResolvedValue(fresh)

    await comfyApp.registerNodes()

    expect(getNodeDefs).toHaveBeenCalledTimes(1)
    expect(internals.registerNodesFromDefs).toHaveBeenCalledWith(fresh)
  })

  test('startNodeDefsPrefetch stores the in-flight defs for reuse', async () => {
    const defs = { A: {} } as unknown as Record<string, ComfyNodeDefV1>
    const getNodeDefs = vi
      .spyOn(comfyApp, 'getNodeDefs')
      .mockResolvedValue(defs)

    internals.startNodeDefsPrefetch()

    expect(getNodeDefs).toHaveBeenCalledTimes(1)
    await expect(internals.nodeDefsPrefetch).resolves.toBe(defs)
  })

  test('startNodeDefsPrefetch swallows a rejection into undefined', async () => {
    vi.spyOn(comfyApp, 'getNodeDefs').mockRejectedValue(new Error('boom'))

    internals.startNodeDefsPrefetch()

    // Must resolve to undefined, never reject (no unhandled rejection), so
    // registerNodes falls back cleanly.
    await expect(internals.nodeDefsPrefetch).resolves.toBeUndefined()
  })

  test('a failed prefetch from startNodeDefsPrefetch falls back to a refetch', async () => {
    const fresh = { B: {} } as unknown as Record<string, ComfyNodeDefV1>
    const getNodeDefs = vi
      .spyOn(comfyApp, 'getNodeDefs')
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(fresh)

    internals.startNodeDefsPrefetch()
    await comfyApp.registerNodes()

    expect(getNodeDefs).toHaveBeenCalledTimes(2)
    expect(internals.registerNodesFromDefs).toHaveBeenCalledWith(fresh)
  })

  test('clears the prefetch so a later call refetches', async () => {
    const defs = { A: {} } as unknown as Record<string, ComfyNodeDefV1>
    const getNodeDefs = vi
      .spyOn(comfyApp, 'getNodeDefs')
      .mockResolvedValue(defs)
    internals.nodeDefsPrefetch = Promise.resolve(defs)

    await comfyApp.registerNodes()
    await comfyApp.registerNodes()

    expect(getNodeDefs).toHaveBeenCalledTimes(1)
  })
})
