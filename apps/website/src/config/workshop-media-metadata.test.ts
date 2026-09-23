import { describe, expect, it, vi } from 'vitest'

import { readWorkshopVideoDuration } from './workshop-media-metadata'

function videoPlatform() {
  const video = document.createElement('video')
  vi.spyOn(document, 'createElement').mockReturnValue(video)
  const duration = vi.spyOn(video, 'duration', 'get')
  const unload = vi.spyOn(video, 'load')
  const create = vi
    .spyOn(URL, 'createObjectURL')
    .mockReturnValue('blob:local-video')
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  return { video, duration, unload, create, revoke }
}

describe('Workshop video metadata', () => {
  it('reads a local video duration and releases its metadata reader', async () => {
    const platform = videoPlatform()
    platform.duration.mockReturnValue(15.5)
    const file = new File(['video'], 'private-video.mp4', {
      type: 'video/mp4'
    })
    const result = readWorkshopVideoDuration(file, new AbortController().signal)

    expect(platform.video.preload).toBe('metadata')
    expect(platform.video.src).toBe('blob:local-video')
    platform.video.dispatchEvent(new Event('loadedmetadata'))

    await expect(result).resolves.toBe(15.5)
    expect(platform.create).toHaveBeenCalledWith(file)
    expect(platform.revoke).toHaveBeenCalledWith('blob:local-video')
    expect(platform.video.hasAttribute('src')).toBe(false)
    expect(platform.video.onloadedmetadata).toBeNull()
    expect(platform.video.onerror).toBeNull()
    expect(platform.unload).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reads remote metadata without revoking a URL it does not own', async () => {
    const platform = videoPlatform()
    platform.duration.mockReturnValue(3.75)
    const source = 'https://media.example/private-video.mp4'
    const result = readWorkshopVideoDuration(
      source,
      new AbortController().signal
    )

    expect(platform.video.src).toBe(source)
    platform.video.dispatchEvent(new Event('loadedmetadata'))

    await expect(result).resolves.toBe(3.75)
    expect(platform.create).not.toHaveBeenCalled()
    expect(platform.revoke).not.toHaveBeenCalled()
    expect(platform.video.hasAttribute('src')).toBe(false)
  })

  it.for([0, -1, Infinity, NaN])(
    'rejects metadata with an unusable duration: %s',
    async (duration) => {
      const platform = videoPlatform()
      platform.duration.mockReturnValue(duration)
      const result = readWorkshopVideoDuration(
        new File(['video'], 'private-video.mp4'),
        new AbortController().signal
      )

      platform.video.dispatchEvent(new Event('loadedmetadata'))

      await expect(result).rejects.toMatchObject({
        name: 'NotSupportedError',
        message: 'Video duration could not be read'
      })
      expect(platform.revoke).toHaveBeenCalledWith('blob:local-video')
      expect(platform.video.hasAttribute('src')).toBe(false)
      expect(vi.getTimerCount()).toBe(0)
    }
  )

  it('reports media errors without including private source details', async () => {
    const platform = videoPlatform()
    const result = readWorkshopVideoDuration(
      'https://media.example/private-video.mp4?token=secret',
      new AbortController().signal
    )

    platform.video.dispatchEvent(new Event('error'))

    await expect(result).rejects.toMatchObject({
      name: 'NotSupportedError',
      message: 'Video duration could not be read'
    })
    expect(platform.video.hasAttribute('src')).toBe(false)
    expect(platform.video.onerror).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops waiting for stalled metadata and releases the file', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const platform = videoPlatform()
    const result = readWorkshopVideoDuration(
      new File(['video'], 'private-video.mp4'),
      new AbortController().signal
    )

    await Promise.all([
      expect(result).rejects.toMatchObject({
        name: 'TimeoutError',
        message: 'Video metadata timed out'
      }),
      vi.advanceTimersByTimeAsync(15_000)
    ])

    expect(platform.revoke).toHaveBeenCalledWith('blob:local-video')
    expect(platform.video.hasAttribute('src')).toBe(false)
    expect(platform.video.onloadedmetadata).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cleans up when the browser refuses to load the video source', async () => {
    const platform = videoPlatform()
    vi.spyOn(platform.video, 'src', 'set').mockImplementation(() => {
      throw new DOMException('Private URL detail', 'SecurityError')
    })

    await expect(
      readWorkshopVideoDuration(
        new File(['video'], 'private-video.mp4'),
        new AbortController().signal
      )
    ).rejects.toMatchObject({
      name: 'NotSupportedError',
      message: 'Video duration could not be read'
    })

    expect(platform.revoke).toHaveBeenCalledWith('blob:local-video')
    expect(platform.video.onloadedmetadata).toBeNull()
    expect(platform.video.onerror).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves cancellation before and during metadata loading', async () => {
    const platform = videoPlatform()
    const controller = new AbortController()
    const file = new File(['video'], 'private-video.mp4')
    const result = readWorkshopVideoDuration(file, controller.signal)
    const reason = new Error('Stop reading')

    controller.abort(reason)

    await expect(result).rejects.toBe(reason)
    expect(platform.revoke).toHaveBeenCalledOnce()
    expect(platform.video.hasAttribute('src')).toBe(false)
    expect(platform.video.onloadedmetadata).toBeNull()
    expect(platform.video.onerror).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    await expect(
      readWorkshopVideoDuration(file, controller.signal)
    ).rejects.toBe(reason)
    expect(platform.create).toHaveBeenCalledOnce()
  })
})
