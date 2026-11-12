import { render } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import {
  createMockCanvasRenderingContext2D,
  stubCanvasGetContext
} from '@/utils/__tests__/canvasTestUtils'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { useImageMenuOptions } from './useImageMenuOptions'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      contextMenu: {
        'Open Image': 'Open Image',
        'Open in Mask Editor': 'Open in Mask Editor',
        'Copy Image': 'Copy Image',
        'Paste Image': 'Paste Image',
        'Save Image': 'Save Image',
        'Download Images': 'Download Images'
      }
    }
  }
})

function mountComposable(): ReturnType<typeof useImageMenuOptions> {
  let composable!: ReturnType<typeof useImageMenuOptions>
  render(
    {
      setup() {
        composable = useImageMenuOptions()
        return () => null
      }
    },
    { global: { plugins: [i18n] } }
  )
  return composable
}

function mockClipboard(clipboard: Partial<Clipboard> | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    value: clipboard,
    writable: true,
    configurable: true
  })
}

function createImageNode(
  overrides: Partial<LGraphNode> | Record<string, unknown> = {}
): LGraphNode {
  const img = new Image()
  img.src = 'http://localhost/test.png'
  Object.defineProperty(img, 'naturalWidth', { value: 100 })
  Object.defineProperty(img, 'naturalHeight', { value: 100 })

  return createMockLGraphNode({
    imgs: [img],
    imageIndex: 0,
    pasteFile: vi.fn(),
    pasteFiles: vi.fn(),
    ...overrides
  })
}

describe('useImageMenuOptions', () => {
  describe('getImageMenuOptions', () => {
    it('includes Paste Image option when node supports paste', () => {
      const node = createImageNode()
      const { getImageMenuOptions } = mountComposable()
      const options = getImageMenuOptions(node)
      const labels = options.map((o) => o.label)

      expect(labels).toContain('Paste Image')
    })

    it('excludes Paste Image option when node does not support paste', () => {
      const node = createImageNode({ pasteFiles: undefined })
      const { getImageMenuOptions } = mountComposable()
      const options = getImageMenuOptions(node)
      const labels = options.map((o) => o.label)

      expect(labels).not.toContain('Paste Image')
    })

    it('returns empty array when node has no images and no pasteFiles', () => {
      const node = createMockLGraphNode({ imgs: [] })
      const { getImageMenuOptions } = mountComposable()

      expect(getImageMenuOptions(node)).toEqual([])
    })

    it.for([
      {
        name: 'several outputs that never loaded as <img> (e.g. EXR)',
        images: [{ filename: 'f1.exr' }, { filename: 'f2.exr' }],
        expected: ['Download Images']
      },
      {
        name: 'a single output',
        images: [{ filename: 'f1.exr' }],
        expected: []
      }
    ])('offers exporting outputs for $name', ({ images, expected }) => {
      const node = createMockLGraphNode({ imgs: [] })
      vi.spyOn(useNodeOutputStore(), 'getNodeOutputs').mockReturnValue({
        images
      })
      const { getImageMenuOptions } = mountComposable()

      expect(getImageMenuOptions(node).map((o) => o.label)).toEqual(expected)
    })

    it('returns only Paste Image when node has no images but supports paste', () => {
      const node = createMockLGraphNode({
        imgs: [],
        pasteFile: vi.fn(),
        pasteFiles: vi.fn()
      })
      const { getImageMenuOptions } = mountComposable()
      const options = getImageMenuOptions(node)
      const labels = options.map((o) => o.label)

      expect(labels).toEqual(['Paste Image'])
    })

    it('places Paste Image between Copy Image and Save Image', () => {
      const node = createImageNode()
      const { getImageMenuOptions } = mountComposable()
      const options = getImageMenuOptions(node)
      const labels = options.map((o) => o.label)

      const copyIdx = labels.indexOf('Copy Image')
      const pasteIdx = labels.indexOf('Paste Image')
      const saveIdx = labels.indexOf('Save Image')

      expect(copyIdx).toBeLessThan(pasteIdx)
      expect(pasteIdx).toBeLessThan(saveIdx)
    })

    it('gives the Open in Mask Editor option the mask icon', () => {
      const node = createImageNode()
      const { getImageMenuOptions } = mountComposable()
      const options = getImageMenuOptions(node)
      const maskOption = options.find((o) => o.label === 'Open in Mask Editor')

      expect(maskOption?.icon).toBe('icon-[comfy--mask]')
    })

    it('gives every image action option an icon so labels stay aligned', () => {
      const node = createImageNode()
      const { getImageMenuOptions } = mountComposable()
      const options = getImageMenuOptions(node)

      expect(options.every((o) => !!o.icon)).toBe(true)
    })

    it('keeps output preview actions when the local image input is unavailable', () => {
      const node = createImageNode()
      const { getImageMenuOptions } = mountComposable()
      const labels = getImageMenuOptions(node, {
        input: false,
        preview: true
      }).map((option) => option.label)

      expect(labels).toContain('Open Image')
      expect(labels).toContain('Save Image')
      expect(labels).not.toContain('Paste Image')
    })
  })

  describe('Copy Image action', () => {
    let original: HTMLImageElement
    let bounds: number[]
    let context: CanvasRenderingContext2D
    const png = new Blob(['original pixels'], { type: 'image/png' })

    beforeEach(() => {
      original = document.createElement('img')
      Object.defineProperties(original, {
        naturalWidth: { value: 4096 },
        naturalHeight: { value: 2048 }
      })
      original.decode = vi.fn().mockResolvedValue(undefined)
      vi.spyOn(globalThis, 'Image').mockImplementation(function () {
        return original
      })
      bounds = []
      context = createMockCanvasRenderingContext2D()
      stubCanvasGetContext(context)
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
        function (this: HTMLCanvasElement, callback) {
          bounds = [this.width, this.height]
          callback(png)
        }
      )
      vi.spyOn(navigator.clipboard, 'write').mockResolvedValue(undefined)
    })

    it('copies the decoded original with its full asymmetric bounds', async () => {
      const display = document.createElement('img')
      display.src = 'blob:display-copy'
      display.dataset.fullSrc = 'http://localhost/original.png'
      Object.defineProperties(display, {
        naturalWidth: { value: 1024 },
        naturalHeight: { value: 512 }
      })
      const node = createMockLGraphNode({ imgs: [display], imageIndex: 0 })
      const { getImageMenuOptions } = mountComposable()
      const copy = getImageMenuOptions(node).find(
        (option) => option.label === 'Copy Image'
      )
      assert.exists(copy?.action)

      await copy.action()

      expect(original.src).toBe('http://localhost/original.png')
      expect(bounds).toEqual([4096, 2048])
      expect(context.drawImage).toHaveBeenCalledWith(original, 0, 0)
      const writes = vi.mocked(navigator.clipboard.write).mock.calls
      expect(writes).toHaveLength(1)
      expect(await writes[0][0][0].getType('image/png')).toBe(png)
    })

    it('warns without changing the clipboard when the original cannot decode', async () => {
      vi.mocked(original.decode).mockRejectedValue(new Error('decode refused'))
      const display = document.createElement('img')
      display.src = 'blob:display-copy'
      display.dataset.fullSrc = 'http://localhost/original.png'
      const node = createMockLGraphNode({ imgs: [display], imageIndex: 0 })
      const { getImageMenuOptions } = mountComposable()
      const copy = getImageMenuOptions(node).find(
        (option) => option.label === 'Copy Image'
      )
      assert.exists(copy?.action)

      await copy.action()

      expect(useToast().toasts).toEqual([
        expect.objectContaining({ kind: 'warning' })
      ])
      expect(navigator.clipboard.write).not.toHaveBeenCalled()
    })
  })

  describe('pasteImage action', () => {
    it('reads clipboard and calls pasteFiles on the node', async () => {
      const node = createImageNode()
      const mockBlob = new Blob(['fake'], { type: 'image/png' })
      const mockClipboardItem = {
        types: ['image/png'],
        getType: vi.fn().mockResolvedValue(mockBlob)
      }

      mockClipboard(
        fromPartial<Clipboard>({
          read: vi.fn().mockResolvedValue([mockClipboardItem])
        })
      )

      const { getImageMenuOptions } = mountComposable()
      const options = getImageMenuOptions(node)
      const pasteOption = options.find((o) => o.label === 'Paste Image')

      await pasteOption!.action!()

      expect(navigator.clipboard.read).toHaveBeenCalled()
      expect(node.pasteFile).toHaveBeenCalledWith(expect.any(File))
      expect(node.pasteFiles).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(File)])
      )
    })

    it('handles missing clipboard API gracefully', async () => {
      const node = createImageNode()
      mockClipboard(fromPartial<Clipboard>({ read: undefined }))

      const { getImageMenuOptions } = mountComposable()
      const options = getImageMenuOptions(node)
      const pasteOption = options.find((o) => o.label === 'Paste Image')

      await expect(pasteOption!.action!()).resolves.toBeUndefined()
      expect(node.pasteFiles).not.toHaveBeenCalled()
    })

    it('handles clipboard with no image data gracefully', async () => {
      const node = createImageNode()
      const mockClipboardItem = {
        types: ['text/plain'],
        getType: vi.fn()
      }

      mockClipboard(
        fromPartial<Clipboard>({
          read: vi.fn().mockResolvedValue([mockClipboardItem])
        })
      )

      const { getImageMenuOptions } = mountComposable()
      const options = getImageMenuOptions(node)
      const pasteOption = options.find((o) => o.label === 'Paste Image')

      await pasteOption!.action!()

      expect(node.pasteFiles).not.toHaveBeenCalled()
    })
  })
})
