import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadFile, openFileInNewTab } from '@/base/common/downloadUtil'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { useImageMenuOptions } from './useImageMenuOptions'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    useI18n: () => ({
      t: (key: string) => key.split('.').pop() ?? key
    })
  }
})

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({ execute: vi.fn() })
}))

vi.mock('@/base/common/downloadUtil', () => ({
  downloadFile: vi.fn(),
  openFileInNewTab: vi.fn()
}))

function mockClipboard(clipboard: Partial<Clipboard> | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    value: clipboard,
    writable: true,
    configurable: true
  })
}

function stubClipboardItem() {
  vi.stubGlobal(
    'ClipboardItem',
    class ClipboardItemStub {
      constructor(public readonly items: Record<string, Blob>) {}
    }
  )
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
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('getImageMenuOptions', () => {
    it('includes Paste Image option when node supports paste', () => {
      const node = createImageNode()
      const { getImageMenuOptions } = useImageMenuOptions()
      const options = getImageMenuOptions(node)
      const labels = options.map((o) => o.label)

      expect(labels).toContain('Paste Image')
    })

    it('excludes Paste Image option when node does not support paste', () => {
      const node = createImageNode({ pasteFiles: undefined })
      const { getImageMenuOptions } = useImageMenuOptions()
      const options = getImageMenuOptions(node)
      const labels = options.map((o) => o.label)

      expect(labels).not.toContain('Paste Image')
    })

    it('returns empty array when node has no images and no pasteFiles', () => {
      const node = createMockLGraphNode({ imgs: [] })
      const { getImageMenuOptions } = useImageMenuOptions()

      expect(getImageMenuOptions(node)).toEqual([])
    })

    it('returns only Paste Image when node has no images but supports paste', () => {
      const node = createMockLGraphNode({
        imgs: [],
        pasteFile: vi.fn(),
        pasteFiles: vi.fn()
      })
      const { getImageMenuOptions } = useImageMenuOptions()
      const options = getImageMenuOptions(node)
      const labels = options.map((o) => o.label)

      expect(labels).toEqual(['Paste Image'])
    })

    it('places Paste Image between Copy Image and Save Image', () => {
      const node = createImageNode()
      const { getImageMenuOptions } = useImageMenuOptions()
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
      const { getImageMenuOptions } = useImageMenuOptions()
      const options = getImageMenuOptions(node)
      const maskOption = options.find((o) => o.label === 'Open in Mask Editor')

      expect(maskOption?.icon).toBe('icon-[comfy--mask]')
    })

    it('gives every image action option an icon so labels stay aligned', () => {
      const node = createImageNode()
      const { getImageMenuOptions } = useImageMenuOptions()
      const options = getImageMenuOptions(node)

      expect(options.every((o) => !!o.icon)).toBe(true)
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

      const { getImageMenuOptions } = useImageMenuOptions()
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

      const { getImageMenuOptions } = useImageMenuOptions()
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

      const { getImageMenuOptions } = useImageMenuOptions()
      const options = getImageMenuOptions(node)
      const pasteOption = options.find((o) => o.label === 'Paste Image')

      await pasteOption!.action!()

      expect(node.pasteFiles).not.toHaveBeenCalled()
    })
  })

  describe('image actions', () => {
    it('opens the selected image without preview query params', () => {
      const node = createImageNode()
      node.imgs![0].src = 'http://localhost/test.png?preview=1&foo=bar'

      const { getImageMenuOptions } = useImageMenuOptions()
      const openOption = getImageMenuOptions(node).find(
        (o) => o.label === 'Open Image'
      )
      openOption?.action?.()

      expect(openFileInNewTab).toHaveBeenCalledWith(
        'http://localhost/test.png?foo=bar'
      )
    })

    it('saves the selected image without preview query params', () => {
      const node = createImageNode()
      node.imgs![0].src = 'http://localhost/test.png?preview=1&foo=bar'

      const { getImageMenuOptions } = useImageMenuOptions()
      const saveOption = getImageMenuOptions(node).find(
        (o) => o.label === 'Save Image'
      )
      saveOption?.action?.()

      expect(downloadFile).toHaveBeenCalledWith(
        'http://localhost/test.png?foo=bar'
      )
    })

    it('does not open or save when the active image is missing', () => {
      const node = createImageNode({ imageIndex: 1 })

      const { getImageMenuOptions } = useImageMenuOptions()
      const options = getImageMenuOptions(node)
      const openOption = options.find((o) => o.label === 'Open Image')
      const saveOption = options.find((o) => o.label === 'Save Image')

      expect(openOption?.action).toEqual(expect.any(Function))
      expect(saveOption?.action).toEqual(expect.any(Function))

      openOption?.action?.()
      saveOption?.action?.()

      expect(openFileInNewTab).not.toHaveBeenCalled()
      expect(downloadFile).not.toHaveBeenCalled()
    })

    it('logs save failures for invalid image URLs', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const node = createImageNode()
      Object.defineProperty(node.imgs![0], 'src', {
        value: 'http://[',
        configurable: true
      })

      const { getImageMenuOptions } = useImageMenuOptions()
      getImageMenuOptions(node)
        .find((o) => o.label === 'Save Image')
        ?.action?.()

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to save image:',
        expect.any(TypeError)
      )
      expect(downloadFile).not.toHaveBeenCalled()
    })

    it('copies the selected image to clipboard', async () => {
      const node = createImageNode()
      const drawImage = vi.fn()
      const write = vi.fn().mockResolvedValue(undefined)
      stubClipboardItem()
      mockClipboard(fromPartial<Clipboard>({ write }))
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
        (() =>
          fromPartial<CanvasRenderingContext2D>({
            drawImage
          })) as unknown as HTMLCanvasElement['getContext']
      )
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
        (callback: BlobCallback) => {
          callback(new Blob(['image'], { type: 'image/png' }))
        }
      )

      const { getImageMenuOptions } = useImageMenuOptions()
      await getImageMenuOptions(node)
        .find((o) => o.label === 'Copy Image')
        ?.action?.()

      expect(drawImage).toHaveBeenCalledWith(node.imgs![0], 0, 0)
      expect(write).toHaveBeenCalledWith([
        expect.objectContaining({
          items: { 'image/png': expect.any(Blob) }
        })
      ])
    })

    it('does not copy when canvas context is unavailable', async () => {
      const node = createImageNode()
      const write = vi.fn()
      mockClipboard(fromPartial<Clipboard>({ write }))
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
        (() => null) as HTMLCanvasElement['getContext']
      )

      const { getImageMenuOptions } = useImageMenuOptions()
      await getImageMenuOptions(node)
        .find((o) => o.label === 'Copy Image')
        ?.action?.()

      expect(write).not.toHaveBeenCalled()
    })

    it('does not copy when canvas blob creation fails', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const node = createImageNode()
      const write = vi.fn()
      mockClipboard(fromPartial<Clipboard>({ write }))
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
        (() =>
          fromPartial<CanvasRenderingContext2D>({
            drawImage: vi.fn()
          })) as unknown as HTMLCanvasElement['getContext']
      )
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
        (callback: BlobCallback) => {
          callback(null)
        }
      )

      const { getImageMenuOptions } = useImageMenuOptions()
      await getImageMenuOptions(node)
        .find((o) => o.label === 'Copy Image')
        ?.action?.()

      expect(warnSpy).toHaveBeenCalledWith('Failed to create image blob')
      expect(write).not.toHaveBeenCalled()
    })
  })
})
