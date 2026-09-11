import type { Mock } from 'vitest'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { createBrowserDownloadService } from './createBrowserDownloadService'

describe('createBrowserDownloadService', () => {
  let anchorElement: HTMLAnchorElement
  let clickSpy: Mock<() => void>

  beforeEach(() => {
    anchorElement = document.createElement('a')
    clickSpy = vi.fn<() => void>()
    anchorElement.click = clickSpy
    vi.spyOn(document, 'createElement').mockReturnValue(anchorElement)
  })

  it('configures the anchor before clicking it', async () => {
    const service = createBrowserDownloadService()

    await service.start({
      url: 'https://example.com/model.safetensors',
      savePath: '/models/checkpoints',
      filename: 'model.safetensors'
    })

    expect(anchorElement.href).toBe('https://example.com/model.safetensors')
    expect(anchorElement.download).toBe('model.safetensors')
    expect(anchorElement.target).toBe('_blank')
    expect(anchorElement.rel).toBe('noopener noreferrer')
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
    const entry = service.getById('anything')
    expect(entry).toBeNull()
  })

  it('onProgress returns a no-op unsubscribe', () => {
    const service = createBrowserDownloadService()
    const unsubscribe = service.onProgress('id', () => {})
    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
  })
})
