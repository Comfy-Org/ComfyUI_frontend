import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fromPartial } from '@total-typescript/shoehorn'
import type * as THREE from 'three'

import type Load3d from '@/extensions/core/load3d/Load3d'
import type { createLoad3d as createLoad3dContract } from '@/extensions/core/load3d/createLoad3d'
import { reportError } from '@/platform/telemetry/reportError'
import { generateModelThumbnail } from './modelThumbnail'

type ThumbnailLoad3d = Pick<Load3d, 'loadModel' | 'captureThumbnail' | 'remove'>

const isAssetPreviewSupported = vi.hoisted(() => vi.fn(() => false))
const persistThumbnail = vi.hoisted(() =>
  vi.fn(async (_assetName: string, _blob: Blob) => {})
)
vi.mock(import('@/platform/assets/utils/assetPreviewUtil'), () => ({
  isAssetPreviewSupported,
  persistThumbnail
}))

const createLoad3d = vi.hoisted(() => vi.fn<typeof createLoad3dContract>())
vi.mock(import('@/extensions/core/load3d/createLoad3d'), () => ({
  createLoad3d
}))

vi.mock(import('@/platform/telemetry/reportError'))
const reportErrorMock = vi.mocked(reportError)

const releaseSharedRenderer = vi.hoisted(() => vi.fn())
vi.mock(import('@/renderer/three/sharedWebGLRenderer'), { spy: true })

import { acquireSharedRenderer } from '@/renderer/three/sharedWebGLRenderer'

function mockInstance(overrides: Partial<ThumbnailLoad3d> = {}): Load3d {
  return fromPartial<Load3d>({
    loadModel: vi.fn().mockResolvedValue('loaded'),
    captureThumbnail: vi.fn().mockResolvedValue('data:image/png;base64,thumb'),
    remove: vi.fn(),
    ...overrides
  })
}

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('generateModelThumbnail', () => {
  beforeEach(() => {
    vi.mocked(acquireSharedRenderer).mockReturnValue({
      renderer: fromPartial<THREE.WebGLRenderer>({}),
      release: releaseSharedRenderer
    })
  })

  it('renders offscreen, returns the data url, and disposes the instance', async () => {
    const instance = mockInstance()
    createLoad3d.mockReturnValue(instance)

    const result = await generateModelThumbnail(
      '/api/view?filename=a.glb',
      'a.glb'
    )

    expect(result).toEqual({
      status: 'rendered',
      dataUrl: 'data:image/png;base64,thumb'
    })
    expect(instance.loadModel).toHaveBeenCalledWith(
      '/api/view?filename=a.glb',
      undefined,
      { silent: true }
    )
    expect(instance.remove).toHaveBeenCalledTimes(1)
    expect(persistThumbnail).not.toHaveBeenCalled()
  })

  it('observes an abort that lands immediately before timeout wiring', async () => {
    const controller = new AbortController()
    vi.mocked(acquireSharedRenderer).mockImplementationOnce(() => {
      controller.abort()
      return {
        renderer: fromPartial<THREE.WebGLRenderer>({}),
        release: releaseSharedRenderer
      }
    })

    await expect(
      generateModelThumbnail('/cancel.glb', 'cancel.glb', controller.signal)
    ).resolves.toEqual({ status: 'cancelled' })
    expect(createLoad3d).not.toHaveBeenCalled()
  })

  it('advances the queue without releasing the underlying work slot', async () => {
    const pendingLoad = deferred<'cancelled'>()
    const stalled = mockInstance({
      loadModel: vi.fn<Load3d['loadModel']>(() => pendingLoad.promise)
    })
    const next = mockInstance()
    createLoad3d.mockReturnValueOnce(stalled).mockReturnValueOnce(next)
    const controller = new AbortController()

    const abortedRun = generateModelThumbnail(
      '/slow.glb',
      'slow.glb',
      controller.signal
    )
    const nextRun = generateModelThumbnail('/next.glb', 'next.glb')
    await vi.advanceTimersByTimeAsync(0)
    expect(createLoad3d).toHaveBeenCalledTimes(1)

    controller.abort()
    await vi.advanceTimersByTimeAsync(0)

    await expect(abortedRun).resolves.toEqual({ status: 'cancelled' })
    await expect(nextRun).resolves.toEqual({
      status: 'rendered',
      dataUrl: 'data:image/png;base64,thumb'
    })
    expect(stalled.remove).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    expect(reportErrorMock).not.toHaveBeenCalled()
    expect(releaseSharedRenderer).not.toHaveBeenCalled()
    pendingLoad.resolve('cancelled')
    await vi.advanceTimersByTimeAsync(0)
  })

  it('skips a queued render whose caller aborted before its turn', async () => {
    const pendingLoad = deferred<'cancelled'>()
    const blocked = mockInstance({
      loadModel: vi.fn<Load3d['loadModel']>(() => pendingLoad.promise)
    })
    const skipped = mockInstance()
    createLoad3d.mockReturnValueOnce(blocked).mockReturnValueOnce(skipped)
    const controller = new AbortController()

    const blockedRun = generateModelThumbnail('/stuck.glb', 'stuck.glb')
    const skippedRun = generateModelThumbnail(
      '/next.glb',
      'next.glb',
      controller.signal
    )
    controller.abort()
    await vi.advanceTimersByTimeAsync(15_000)

    await expect(blockedRun).resolves.toEqual({ status: 'timedOut' })
    await expect(skippedRun).resolves.toEqual({ status: 'cancelled' })
    expect(createLoad3d).toHaveBeenCalledTimes(1)
    pendingLoad.resolve('cancelled')
    await vi.advanceTimersByTimeAsync(0)
  })

  it('reports a failed render and still disposes the instance', async () => {
    const instance = mockInstance({
      loadModel: vi.fn().mockRejectedValue(new Error('bad model'))
    })
    createLoad3d.mockReturnValue(instance)

    const result = await generateModelThumbnail('/broken.glb', 'broken.glb')

    expect(result).toEqual({ status: 'failed' })
    expect(instance.remove).toHaveBeenCalledTimes(1)
  })

  it('reports non-Error loader rejections as sanitized errors', async () => {
    const instance = mockInstance({
      loadModel: vi
        .fn()
        .mockRejectedValue(
          'failed https://user:secret@example.com/model.glb?token=private'
        )
    })
    createLoad3d.mockReturnValue(instance)

    await expect(
      generateModelThumbnail('/broken.glb', 'broken.glb')
    ).resolves.toEqual({ status: 'failed' })
    expect(reportErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'failed https://example.com/model.glb'
      }),
      {
        errorType: 'agent_model_thumbnail_generation_failure',
        surface: 'agent'
      }
    )
  })

  it('reports a non-loaded model outcome as a failure', async () => {
    const instance = mockInstance({
      loadModel: vi.fn().mockResolvedValue('empty')
    })
    createLoad3d.mockReturnValue(instance)

    await expect(
      generateModelThumbnail('/unknown.bin', 'unknown.bin')
    ).resolves.toEqual({ status: 'failed' })
    expect(reportErrorMock).toHaveBeenCalledOnce()
  })

  it('reports renderer acquisition failures as a failed result', async () => {
    vi.mocked(acquireSharedRenderer).mockImplementationOnce(() => {
      throw new Error('WebGL context unavailable')
    })

    await expect(
      generateModelThumbnail('/model.glb', 'model.glb')
    ).resolves.toEqual({ status: 'failed' })
    expect(reportErrorMock).toHaveBeenCalledOnce()
    expect(createLoad3d).not.toHaveBeenCalled()
  })

  it('redacts credentials from protocol-relative URLs before reporting', async () => {
    const failure = new Error(
      'Could not load //user:secret@example.com/model.glb?token=private'
    )
    failure.name =
      'AssetLoadError https://user:secret@example.com/name?token=private'
    const instance = mockInstance({
      loadModel: vi.fn().mockRejectedValue(failure)
    })
    createLoad3d.mockReturnValue(instance)

    await generateModelThumbnail(
      '//user:secret@example.com/model.glb?token=private',
      'model.glb'
    )

    const [reportedError] = reportErrorMock.mock.calls[0]
    if (!(reportedError instanceof Error)) throw new Error('Expected an Error')
    expect(reportedError).toMatchObject({
      message: 'Could not load //example.com/model.glb',
      name: 'AssetLoadError https://example.com/name'
    })
    expect(reportedError.stack).not.toContain('secret')
    expect(reportedError.stack).not.toContain('private')
  })

  it('runs generations one at a time', async () => {
    let releaseFirst!: () => void
    const first = mockInstance({
      loadModel: vi.fn(
        () =>
          new Promise<'loaded'>((resolve) => {
            releaseFirst = () => resolve('loaded')
          })
      )
    })
    const second = mockInstance()
    createLoad3d.mockReturnValueOnce(first).mockReturnValueOnce(second)

    const firstRun = generateModelThumbnail('/one.glb', 'one.glb')
    const secondRun = generateModelThumbnail('/two.glb', 'two.glb')
    await vi.waitFor(() => expect(createLoad3d).toHaveBeenCalledTimes(1))

    releaseFirst()
    await firstRun
    expect(releaseSharedRenderer).not.toHaveBeenCalled()
    await secondRun

    expect(createLoad3d).toHaveBeenCalledTimes(2)
    expect(releaseSharedRenderer).toHaveBeenCalledOnce()
  })

  it('keeps a cancelled underlying load charged against queue capacity', async () => {
    const controllers = Array.from({ length: 32 }, () => new AbortController())
    let settleLoad!: (outcome: 'cancelled') => void
    const stalled = mockInstance({
      loadModel: vi.fn<Load3d['loadModel']>(
        () =>
          new Promise((resolve) => {
            settleLoad = resolve
          })
      )
    })
    createLoad3d.mockReturnValueOnce(stalled).mockReturnValue(mockInstance())

    const accepted = controllers.map((controller, index) =>
      generateModelThumbnail(
        `/queued-${index}.glb`,
        `queued-${index}.glb`,
        controller.signal
      )
    )
    await vi.waitFor(() => expect(stalled.loadModel).toHaveBeenCalledOnce())

    await expect(
      generateModelThumbnail('/busy.glb', 'busy.glb')
    ).resolves.toEqual({ status: 'busy' })

    controllers[0].abort()
    await expect(accepted[0]).resolves.toEqual({ status: 'cancelled' })

    await expect(
      generateModelThumbnail('/still-busy.glb', 'still-busy.glb')
    ).resolves.toEqual({ status: 'busy' })
    controllers.slice(1).forEach((controller) => controller.abort())

    await expect(Promise.all(accepted.slice(1))).resolves.toEqual(
      Array.from({ length: 31 }, () => ({ status: 'cancelled' }))
    )
    expect(createLoad3d).toHaveBeenCalledOnce()
    expect(releaseSharedRenderer).not.toHaveBeenCalled()

    settleLoad('cancelled')
    await vi.waitFor(() => expect(releaseSharedRenderer).toHaveBeenCalledOnce())

    await expect(
      generateModelThumbnail('/restored.glb', 'restored.glb')
    ).resolves.toEqual({
      status: 'rendered',
      dataUrl: 'data:image/png;base64,thumb'
    })
    expect(releaseSharedRenderer).toHaveBeenCalledTimes(2)
  })

  it('times out a stuck load, disposes it, and advances the queue', async () => {
    const pendingLoad = deferred<'cancelled'>()
    const stuck = mockInstance({
      loadModel: vi.fn<Load3d['loadModel']>(() => pendingLoad.promise)
    })
    const next = mockInstance()
    createLoad3d.mockReturnValueOnce(stuck).mockReturnValueOnce(next)

    const stuckRun = generateModelThumbnail('/stuck.glb', 'stuck.glb')
    const nextRun = generateModelThumbnail('/next.glb', 'next.glb')
    await vi.waitFor(() => expect(createLoad3d).toHaveBeenCalledTimes(1))

    await vi.advanceTimersByTimeAsync(15_000)

    await expect(stuckRun).resolves.toEqual({ status: 'timedOut' })
    await expect(nextRun).resolves.toEqual({
      status: 'rendered',
      dataUrl: 'data:image/png;base64,thumb'
    })
    expect(stuck.remove).toHaveBeenCalledTimes(1)
    expect(reportErrorMock).not.toHaveBeenCalled()
    expect(next.loadModel).toHaveBeenCalledWith('/next.glb', undefined, {
      silent: true
    })
    pendingLoad.resolve('cancelled')
    await vi.advanceTimersByTimeAsync(0)
  })

  it('times out a stuck capture and advances the queue', async () => {
    const pendingCapture = deferred<string>()
    const stuck = mockInstance({
      captureThumbnail: vi.fn(() => pendingCapture.promise)
    })
    const next = mockInstance()
    createLoad3d.mockReturnValueOnce(stuck).mockReturnValueOnce(next)

    const stuckRun = generateModelThumbnail('/stuck.glb', 'stuck.glb')
    const nextRun = generateModelThumbnail('/next.glb', 'next.glb')
    await vi.waitFor(() => expect(stuck.captureThumbnail).toHaveBeenCalled())

    await vi.advanceTimersByTimeAsync(15_000)

    await expect(stuckRun).resolves.toEqual({ status: 'timedOut' })
    await expect(nextRun).resolves.toEqual({
      status: 'rendered',
      dataUrl: 'data:image/png;base64,thumb'
    })
    expect(stuck.remove).toHaveBeenCalledOnce()
    expect(reportErrorMock).not.toHaveBeenCalled()
    expect(next.captureThumbnail).toHaveBeenCalledOnce()
    pendingCapture.resolve('data:image/png;base64,late')
    await vi.advanceTimersByTimeAsync(0)
  })

  it('persists a supported asset thumbnail after rendering', async () => {
    const instance = mockInstance()
    createLoad3d.mockReturnValue(instance)
    isAssetPreviewSupported.mockReturnValue(true)
    const blob = new Blob(['thumbnail'], { type: 'image/png' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(blob))

    await generateModelThumbnail('/model.glb', 'model.glb')
    await vi.waitFor(() => expect(persistThumbnail).toHaveBeenCalledOnce())

    const [assetName, persistedBlob] = persistThumbnail.mock.calls[0]
    expect(assetName).toBe('model.glb')
    expect(persistedBlob).toBeInstanceOf(Blob)
    expect(persistedBlob.type).toBe('image/png')
    await expect(persistedBlob.text()).resolves.toBe('thumbnail')
  })
})
