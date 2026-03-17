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
  })

  describe('pasteImage action', () => {
    it('reads clipboard and calls pasteFiles on the node', async () => {
      const node = createImageNode()
      const mockBlob = new Blob(['fake'], { type: 'image/png' })
      const mockClipboardItem = {
        types: ['image/png'],
        getType: vi.fn().mockResolvedValue(mockBlob)
      }

      mockClipboard({
        read: vi.fn().mockResolvedValue([mockClipboardItem])
      } as unknown as Clipboard)

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
      mockClipboard({ read: undefined } as unknown as Clipboard)

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

      mockClipboard({
        read: vi.fn().mockResolvedValue([mockClipboardItem])
      } as unknown as Clipboard)

      const { getImageMenuOptions } = useImageMenuOptions()
      const options = getImageMenuOptions(node)
      const pasteOption = options.find((o) => o.label === 'Paste Image')

      await pasteOption!.action!()

      expect(node.pasteFiles).not.toHaveBeenCalled()
    })
  })
})
