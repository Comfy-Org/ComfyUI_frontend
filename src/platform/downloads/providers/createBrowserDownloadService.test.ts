import { describe, expect, it, vi, beforeEach } from 'vitest'

import { createBrowserDownloadService } from './createBrowserDownloadService'

describe('createBrowserDownloadService', () => {
  let clickSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    clickSpy = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValue({
      set href(_: string) {},
      set download(_: string) {},
      set target(_: string) {},
      set rel(_: string) {},
      click: clickSpy
    } as unknown as HTMLAnchorElement)
  })

  it('returns a completed entry after triggering a browser download', async () => {
    const service = createBrowserDownloadService()

    const entry = await service.start({
      url: 'https://example.com/model.safetensors',
      savePath: '/models/checkpoints',
      filename: 'model.safetensors'
    })

    expect(clickSpy).toHaveBeenCalledOnce()
    expect(entry).toMatchObject({
      id: 'https://example.com/model.safetensors',
      url: 'https://example.com/model.safetensors',
      filename: 'model.safetensors',
      savePath: '/models/checkpoints',
      status: 'completed',
      progress: 1
    })
  })

  it('does not support pause/resume', () => {
    const service = createBrowserDownloadService()
    expect(service.supportsPauseResume).toBe(false)
  })

  it('getAll returns empty array', () => {
    const service = createBrowserDownloadService()
    expect(service.getAll()).toEqual([])
  })

  it('getById returns null', () => {
    const service = createBrowserDownloadService()
    expect(service.getById('anything')).toBeNull()
  })

  it('onProgress returns a no-op unsubscribe', () => {
    const service = createBrowserDownloadService()
    const unsubscribe = service.onProgress('id', () => {})
    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
  })
})
