import { render } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { createI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
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
        'Download Images': 'Download Images',
        'Show Full Resolution': 'Show Full Resolution',
        'Show Downscaled Preview': 'Show Downscaled Preview'
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
    it('keeps preview-only image nodes editable', () => {
      const node = createImageNode({ previewMediaType: 'image', imgs: [] })
      const { getImageMenuOptions } = mountComposable()

      expect(getImageMenuOptions(node).map((option) => option.id)).toContain(
        'maskEditor'
      )
    })

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
    function createCopyImageFixture() {
      const display = document.createElement('img')
      display.src =
        'https://app.example/api/view?filename=output.png&preview=webp'
      const node = createMockLGraphNode({ imgs: [display], imageIndex: 0 })
      const { getImageMenuOptions } = mountComposable()
      const copy = getImageMenuOptions(node).find(
        (option) => option.label === 'Copy Image'
      )
      assert.exists(copy?.action)

      return copy.action
    }

    it('copies full-resolution PNG bytes without exporting the displayed image', async () => {
      const copy = createCopyImageFixture()
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(() => {
        throw new DOMException(
          'Tainted canvases may not be exported.',
          'SecurityError'
        )
      })
      const png = new Blob(['original pixels'], { type: 'image/png' })
      vi.mocked(fetch).mockResolvedValue(new Response(png))
      const write = vi
        .spyOn(navigator.clipboard, 'write')
        .mockResolvedValue(undefined)

      const copying = copy()
      expect(write).toHaveBeenCalledOnce()
      await copying

      expect(fetch).toHaveBeenCalledWith(
        new URL('https://app.example/api/view?filename=output.png')
      )
      const copied = await write.mock.calls[0][0][0].getType('image/png')
      expect(await copied.text()).toBe('original pixels')
    })

    it('warns when the original cannot be fetched', async () => {
      const copy = createCopyImageFixture()
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 403 }))
      vi.spyOn(navigator.clipboard, 'write').mockImplementation(
        async ([item]) => {
          await item.getType('image/png')
        }
      )

      await copy()

      expect(useToast().toasts).toEqual([
        expect.objectContaining({ kind: 'warning' })
      ])
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

  describe('getPreviewResolutionOption', () => {
    function useVueNodes(enabled: boolean) {
      LiteGraph.vueNodesMode = enabled
      onTestFinished(() => {
        LiteGraph.vueNodesMode = false
      })
    }

    function outputImages(count: number) {
      vi.spyOn(useNodeOutputStore(), 'getNodeOutputs').mockReturnValue({
        images: Array.from({ length: count }, (_, i) => ({
          filename: `image${i}.png`,
          type: 'output' as const
        }))
      })
    }

    beforeEach(() => {
      useSettingStore().settingValues['Comfy.Node.DownscaleImagePreviews'] =
        true
    })

    it.for([
      {
        name: 'offers full resolution for a single image',
        vueNodes: true,
        images: 1,
        flags: {},
        label: 'Show Full Resolution'
      },
      {
        name: 'offers the downscaled preview once full resolution is on',
        vueNodes: true,
        images: 1,
        flags: { fullResolutionPreview: true },
        label: 'Show Downscaled Preview'
      },
      {
        name: 'is absent for a grid of images',
        vueNodes: true,
        images: 2,
        flags: {},
        label: undefined
      },
      {
        name: 'is absent on the classic canvas, which never downscales',
        vueNodes: false,
        images: 1,
        flags: {},
        label: undefined
      },
      {
        name: 'is absent when downscaling is turned off globally',
        vueNodes: true,
        images: 1,
        flags: {},
        downscale: false,
        label: undefined
      }
    ])('$name', ({ vueNodes, images, flags, downscale = true, label }) => {
      useVueNodes(vueNodes)
      useSettingStore().settingValues['Comfy.Node.DownscaleImagePreviews'] =
        downscale
      outputImages(images)
      const { getPreviewResolutionOption } = mountComposable()

      expect(
        getPreviewResolutionOption(createImageNode({ flags }))?.label
      ).toBe(label)
    })

    it('persists the toggle through workflow serialization', () => {
      useVueNodes(true)
      outputImages(1)
      const { getPreviewResolutionOption } = mountComposable()
      const node = new LGraphNode('PreviewImage')
      node.previewMediaType = 'image'

      getPreviewResolutionOption(node)?.action?.()
      const restored = new LGraphNode('PreviewImage')
      restored.previewMediaType = 'image'
      restored.configure(node.serialize())

      expect(getPreviewResolutionOption(restored)?.label).toBe(
        'Show Downscaled Preview'
      )
      getPreviewResolutionOption(restored)?.action?.()
      expect(restored.serialize().flags).not.toHaveProperty(
        'fullResolutionPreview'
      )
    })
  })
})
