import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { snapshotNodeMedia } from './renderWorkflowImage'

const SRC = 'https://storage.example/image.png'

function snapshotTaintedImage() {
  const img = new Image()
  Object.defineProperties(img, {
    naturalWidth: { value: 4 },
    naturalHeight: { value: 4 },
    currentSrc: { value: SRC }
  })
  const ctx: CanvasRenderingContext2D | null = fromPartial({
    drawImage: vi.fn(),
    getImageData: () => {
      throw new DOMException('Tainted', 'SecurityError')
    }
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    (() => ctx) as typeof HTMLCanvasElement.prototype.getContext
  )
  return snapshotNodeMedia({ element: img, x: 0, y: 0, width: 4, height: 4 }, 1)
}

describe('snapshotNodeMedia', () => {
  it('refetches tainted images as a readable bitmap', async () => {
    const bitmap = fromPartial<ImageBitmap>({})
    vi.mocked(fetch).mockResolvedValue(new Response(new Blob()))
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap)
    )

    const result = await snapshotTaintedImage()

    expect(fetch).toHaveBeenCalledWith(SRC)
    expect(result.ok && result.media[0].image).toBe(bitmap)
  })
})
