// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'

import { rasterizeSvgImage } from './workshop-svg-rasterizer'

function imagePlatform() {
  const images: HTMLImageElement[] = []
  const BrowserImage = Image
  vi.stubGlobal(
    'Image',
    class extends BrowserImage {
      constructor() {
        super()
        images.push(this)
      }
    }
  )
  const create = vi
    .spyOn(URL, 'createObjectURL')
    .mockReturnValue('blob:svg-source')
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const draw = vi.fn()
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
  vi.mocked(context, { partial: true }).mockReturnValue({ drawImage: draw })
  const encode = vi
    .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockReturnValue('data:image/png;base64,AA==')
  return { images, create, revoke, draw, context, encode }
}

describe('browser SVG rasterizer', () => {
  it.for([
    '<html/>',
    '<svg xmlns="https://wrong.invalid" width="1" height="1"/>',
    '<!DOCTYPE svg><svg/>',
    '<svg>' + ' '.repeat(4 * 1024 * 1024) + '</svg>'
  ])(
    'rejects invalid or oversized documents without creating an image',
    async (svg) => {
      const platform = imagePlatform()
      await expect(rasterizeSvgImage({ svg })).rejects.toThrow(
        /Invalid SVG document|supported document limits/
      )
      expect(platform.create).not.toHaveBeenCalled()
      expect(platform.images).toHaveLength(0)
    }
  )

  it.for([
    '',
    'width="0" height="1"',
    'width="-1" height="2"',
    'width="Infinity" height="1"',
    'width="8193" height="1"',
    'width="8192" height="8192"'
  ])('rejects unsafe dimensions before decoding: %s', async (dimensions) => {
    const platform = imagePlatform()
    await expect(
      rasterizeSvgImage({
        svg: `<svg xmlns="http://www.w3.org/2000/svg" ${dimensions}/>`
      })
    ).rejects.toThrow('SVG exceeds the supported image dimensions')
    expect(platform.create).not.toHaveBeenCalled()
  })

  it.for(['width="8.2px" height="4.1px"', 'viewBox="0 0 8.2 4.1"'])(
    'normalizes dimensions, draws the decoded image, and releases resources: %s',
    async (dimensions) => {
      const platform = imagePlatform()
      const result = rasterizeSvgImage({
        svg: `<svg xmlns="http://www.w3.org/2000/svg" ${dimensions}/>`
      })
      platform.images[0].dispatchEvent(new Event('load'))
      await expect(result).resolves.toBe('data:image/png;base64,AA==')
      expect(platform.draw).toHaveBeenCalledWith(platform.images[0], 0, 0, 9, 5)
      expect(platform.encode).toHaveBeenCalledWith('image/png')
      expect(platform.revoke).toHaveBeenCalledWith('blob:svg-source')
      expect(platform.images[0].onload).toBeNull()
      expect(platform.images[0].onerror).toBeNull()
      expect(platform.images[0].getAttribute('src')).toBe('')
      expect(platform.context.mock.contexts[0]).toMatchObject({
        width: 0,
        height: 0
      })
    }
  )

  it.for(['decode', 'canvas', 'encoding', 'oversize'])(
    'releases resources after a %s failure',
    async (failure) => {
      const platform = imagePlatform()
      if (failure === 'canvas') platform.context.mockReturnValue(null)
      if (failure === 'encoding') platform.encode.mockReturnValue('data:,')
      if (failure === 'oversize')
        platform.encode.mockReturnValue(
          'data:image/png;base64,' + 'A'.repeat(48 * 1024 * 1024)
        )
      const result = rasterizeSvgImage({
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>'
      })
      platform.images[0].dispatchEvent(
        new Event(failure === 'decode' ? 'error' : 'load')
      )
      await expect(result).rejects.toThrow(
        /could not be decoded|rendering is unavailable|output limit/
      )
      expect(platform.revoke).toHaveBeenCalledWith('blob:svg-source')
      expect(platform.images[0].onload).toBeNull()
      expect(platform.images[0].onerror).toBeNull()
    }
  )

  it('times out a stalled decoder and releases its source', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const platform = imagePlatform()
    const result = rasterizeSvgImage({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>'
    })
    await Promise.all([
      expect(result).rejects.toThrow('SVG rendering timed out'),
      vi.advanceTimersByTimeAsync(5_000)
    ])
    expect(platform.revoke).toHaveBeenCalledWith('blob:svg-source')
  })

  it('preserves caller cancellation before and during decoding', async () => {
    const platform = imagePlatform()
    const controller = new AbortController()
    const options = {
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>',
      signal: controller.signal
    }
    const result = rasterizeSvgImage(options)
    const reason = new Error('Stop preview')
    controller.abort(reason)
    await expect(result).rejects.toBe(reason)
    expect(platform.revoke).toHaveBeenCalledOnce()
    await expect(rasterizeSvgImage(options)).rejects.toBe(reason)
    expect(platform.create).toHaveBeenCalledOnce()
  })
})
