import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fromPartial } from '@total-typescript/shoehorn'

import type { createLoad3d } from '@/extensions/core/load3d/createLoad3d'
import type Load3d from '@/extensions/core/load3d/Load3d'
import type { SharedRendererHandle } from '@/renderer/three/sharedWebGLRenderer'

const load3dModule = vi.hoisted(() => {
  const deferred = () => {
    let resolve = () => {}
    const promise = new Promise<void>((promiseResolve) => {
      resolve = promiseResolve
    })
    return { promise, resolve }
  }
  const importStarted = deferred()
  const importReady = deferred()
  return { create: vi.fn<typeof createLoad3d>(), importStarted, importReady }
})

vi.mock(import('@/renderer/three/sharedWebGLRenderer'), () => ({
  acquireSharedRenderer: vi.fn(() =>
    fromPartial<SharedRendererHandle>({ release: vi.fn() })
  )
}))

vi.mock(import('@/extensions/core/load3d/createLoad3d'), async () => {
  load3dModule.importStarted.resolve()
  await load3dModule.importReady.promise
  return { createLoad3d: load3dModule.create }
})

vi.mock(import('@/platform/assets/utils/assetPreviewUtil'), () => ({
  isAssetPreviewSupported: vi.fn(() => false),
  persistThumbnail: vi.fn()
}))

vi.mock(import('@/platform/telemetry/reportError'))

import { generateModelThumbnail } from './modelThumbnail'

describe('generateModelThumbnail deferred createLoad3d import', () => {
  beforeEach(() => {
    load3dModule.create.mockReturnValue(
      fromPartial<Load3d>({
        loadModel: vi.fn().mockResolvedValue('loaded'),
        captureThumbnail: vi
          .fn()
          .mockResolvedValue('data:image/png;base64,thumb'),
        remove: vi.fn()
      })
    )
  })

  it('times out module acquisition and advances the queued successor', async () => {
    const timedOut = generateModelThumbnail('/deferred.glb', 'deferred.glb')
    const nextController = new AbortController()
    const next = generateModelThumbnail(
      '/next.glb',
      'next.glb',
      nextController.signal
    )
    await load3dModule.importStarted.promise

    await vi.advanceTimersByTimeAsync(15_000)
    await expect(timedOut).resolves.toEqual({ status: 'timedOut' })

    nextController.abort()
    await vi.advanceTimersByTimeAsync(0)

    await expect(next).resolves.toEqual({ status: 'cancelled' })
    expect(load3dModule.create).not.toHaveBeenCalled()
    load3dModule.importReady.resolve()
    await vi.runAllTimersAsync()
    expect(load3dModule.create).not.toHaveBeenCalled()
  })
})
