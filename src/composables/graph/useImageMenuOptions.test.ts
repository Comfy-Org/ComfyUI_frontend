import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

const { addAlert } = vi.hoisted(() => ({ addAlert: vi.fn() }))
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ addAlert })
}))

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
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    addAlert.mockClear()
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

  describe('copyImage action', () => {
    /**
     * Capture-only ClipboardItem stub. jsdom has no ClipboardItem, and we want
     * to resolve the PNG blob promise the composable hands it so assertions can
     * read what would be placed on the real clipboard.
     */
    function stubClipboardItem() {
      vi.stubGlobal(
        'ClipboardItem',
        class {
          data: Record<string, Blob | Promise<Blob>>
          constructor(data: Record<string, Blob | Promise<Blob>>) {
            this.data = data
          }
        }
      )
    }

    function getCopyAction(node: LGraphNode) {
      const { getImageMenuOptions } = useImageMenuOptions()
      return getImageMenuOptions(node).find((o) => o.label === 'Copy Image')!
        .action!
    }

    it('fetches the image and writes a PNG blob to the clipboard', async () => {
      const node = createImageNode()
      const pngBlob = new Blob(['png'], { type: 'image/png' })
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(pngBlob)
      })
      vi.stubGlobal('fetch', fetchMock)
      stubClipboardItem()

      const write = vi.fn().mockResolvedValue(undefined)
      mockClipboard(fromPartial<Clipboard>({ write }))

      await getCopyAction(node)()

      // Fetches the source URL instead of exporting the (cloud-tainted) canvas.
      expect(fetchMock).toHaveBeenCalledWith('http://localhost/test.png')
      const item = write.mock.calls[0][0][0] as {
        data: Record<string, unknown>
      }
      await expect(item.data['image/png']).resolves.toBe(pngBlob)
    })

    it('strips the preview query param before fetching', async () => {
      const img = new Image()
      img.src = 'http://localhost/view?filename=a.png&preview=webp'
      const node = createImageNode({ imgs: [img] })

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['png'], { type: 'image/png' }))
      })
      vi.stubGlobal('fetch', fetchMock)
      stubClipboardItem()
      mockClipboard(
        fromPartial<Clipboard>({ write: vi.fn().mockResolvedValue(undefined) })
      )

      await getCopyAction(node)()

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost/view?filename=a.png'
      )
    })

    it('re-encodes a non-PNG source to PNG before writing', async () => {
      const node = createImageNode()
      const jpegBlob = new Blob(['jpeg'], { type: 'image/jpeg' })
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          blob: () => Promise.resolve(jpegBlob)
        })
      )
      stubClipboardItem()

      // jsdom implements neither createImageBitmap nor canvas.toBlob, so stub
      // the decode + re-encode pipeline the non-PNG branch relies on.
      const bitmap = { width: 2, height: 2, close: vi.fn() }
      vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
      const pngBlob = new Blob(['png'], { type: 'image/png' })
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        fromPartial<CanvasRenderingContext2D>({ drawImage: vi.fn() }) as never
      )
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) =>
        cb(pngBlob)
      )

      const write = vi.fn().mockResolvedValue(undefined)
      mockClipboard(fromPartial<Clipboard>({ write }))

      await getCopyAction(node)()

      // Await the deferred PNG promise first so the re-encode chain runs.
      const item = write.mock.calls[0][0][0] as {
        data: Record<string, unknown>
      }
      await expect(item.data['image/png']).resolves.toBe(pngBlob)
      expect(createImageBitmap).toHaveBeenCalledWith(jpegBlob)
      expect(bitmap.close).toHaveBeenCalled()
    })

    it('alerts the user when the clipboard API is unavailable', async () => {
      const node = createImageNode()
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      mockClipboard(fromPartial<Clipboard>({ write: undefined }))

      await expect(getCopyAction(node)()).resolves.toBeUndefined()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(addAlert).toHaveBeenCalledWith('errorCopyImage')
    })
  })
})
