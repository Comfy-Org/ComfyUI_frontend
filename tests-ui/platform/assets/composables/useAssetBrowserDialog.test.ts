import { describe, expect, it, vi } from 'vitest'

import { useAssetBrowserDialog } from '@/platform/assets/composables/useAssetBrowserDialog'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock('@/stores/dialogStore')

vi.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, string>) => {
    if (params) {
      return `${key}:${JSON.stringify(params)}`
    }
    return key
  }
}))

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    getAssetsForNodeType: vi.fn().mockResolvedValue([]),
    getAssetsByTag: vi.fn().mockResolvedValue([])
  }
}))

const { assetService } = await import('@/platform/assets/services/assetService')
const mockGetAssetsByTag = vi.mocked(assetService.getAssetsByTag)
const mockGetAssetsForNodeType = vi.mocked(assetService.getAssetsForNodeType)

function createMockAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'asset-123',
    name: 'test-model.safetensors',
    size: 1024,
    created_at: '2025-10-01T00:00:00Z',
    tags: ['models', 'checkpoints'],
    user_metadata: {
      filename: 'models/checkpoints/test-model.safetensors'
    },
    ...overrides
  }
}

function setupDialogMocks() {
  const mockShowDialog = vi.fn()
  const mockCloseDialog = vi.fn()
  vi.mocked(useDialogStore).mockReturnValue({
    showDialog: mockShowDialog,
    closeDialog: mockCloseDialog
  } as Partial<ReturnType<typeof useDialogStore>> as ReturnType<
    typeof useDialogStore
  >)
  return { mockShowDialog, mockCloseDialog }
}

describe('useAssetBrowserDialog', () => {
  describe('Asset Selection Flow', () => {
    it('auto-closes dialog when asset is selected', async () => {
      const mockShowDialog = vi.fn()
      const mockCloseDialog = vi.fn()

      vi.mocked(useDialogStore).mockReturnValue({
        showDialog: mockShowDialog,
        closeDialog: mockCloseDialog
      } as Partial<ReturnType<typeof useDialogStore>> as ReturnType<
        typeof useDialogStore
      >)

      const assetBrowserDialog = useAssetBrowserDialog()
      const onAssetSelected = vi.fn()

      await assetBrowserDialog.show({
        nodeType: 'CheckpointLoaderSimple',
        inputName: 'ckpt_name',
        onAssetSelected
      })

      const dialogCall = mockShowDialog.mock.calls[0][0]
      const onSelectHandler = dialogCall.props.onSelect

      const mockAsset = {
        id: 'test-asset-id',
        name: 'test.safetensors',
        size: 1024,
        created_at: '2025-10-01T00:00:00Z',
        tags: ['models', 'checkpoints'],
        user_metadata: { filename: 'selected-asset-path' }
      }
      onSelectHandler(mockAsset)

      expect(onAssetSelected).toHaveBeenCalledWith(mockAsset)
      expect(mockCloseDialog).toHaveBeenCalledWith({
        key: 'global-asset-browser'
      })
    })

    it('closes dialog when close handler is called', async () => {
      const mockShowDialog = vi.fn()
      const mockCloseDialog = vi.fn()

      vi.mocked(useDialogStore).mockReturnValue({
        showDialog: mockShowDialog,
        closeDialog: mockCloseDialog
      } as Partial<ReturnType<typeof useDialogStore>> as ReturnType<
        typeof useDialogStore
      >)

      const assetBrowserDialog = useAssetBrowserDialog()

      await assetBrowserDialog.show({
        nodeType: 'CheckpointLoaderSimple',
        inputName: 'ckpt_name'
      })

      const dialogCall = mockShowDialog.mock.calls[0][0]
      const onCloseHandler = dialogCall.props.onClose

      onCloseHandler()

      expect(mockCloseDialog).toHaveBeenCalledWith({
        key: 'global-asset-browser'
      })
    })
  })

  describe('.browse() method', () => {
    it('opens asset browser dialog with tag-based filtering', async () => {
      const mockShowDialog = vi.fn()
      const mockCloseDialog = vi.fn()

      vi.mocked(useDialogStore).mockReturnValue({
        showDialog: mockShowDialog,
        closeDialog: mockCloseDialog
      } as Partial<ReturnType<typeof useDialogStore>> as ReturnType<
        typeof useDialogStore
      >)

      const assetBrowserDialog = useAssetBrowserDialog()
      await assetBrowserDialog.browse({
        assetType: 'models',
        title: 'Model Library'
      })

      expect(mockShowDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'global-asset-browser',
          props: expect.objectContaining({
            showLeftPanel: true
          })
        })
      )
    })

    it('calls onAssetSelected callback when asset is selected', async () => {
      const mockShowDialog = vi.fn()
      const mockCloseDialog = vi.fn()
      const mockAsset = createMockAsset()
      const onAssetSelected = vi.fn()

      vi.mocked(useDialogStore).mockReturnValue({
        showDialog: mockShowDialog,
        closeDialog: mockCloseDialog
      } as Partial<ReturnType<typeof useDialogStore>> as ReturnType<
        typeof useDialogStore
      >)

      const assetBrowserDialog = useAssetBrowserDialog()
      await assetBrowserDialog.browse({
        assetType: 'models',
        onAssetSelected
      })

      // Get the onSelect handler that was passed to the dialog
      const dialogCall = mockShowDialog.mock.calls[0][0]
      const onSelectHandler = dialogCall.props.onSelect

      // Simulate asset selection by passing the asset object
      onSelectHandler(mockAsset)

      // Should call the callback with the full AssetItem
      expect(onAssetSelected).toHaveBeenCalledWith(mockAsset)
    })

    it('closes dialog after asset selection', async () => {
      const mockShowDialog = vi.fn()
      const mockCloseDialog = vi.fn()
      const mockAsset = createMockAsset()

      vi.mocked(useDialogStore).mockReturnValue({
        showDialog: mockShowDialog,
        closeDialog: mockCloseDialog
      } as Partial<ReturnType<typeof useDialogStore>> as ReturnType<
        typeof useDialogStore
      >)

      const assetBrowserDialog = useAssetBrowserDialog()
      await assetBrowserDialog.browse({
        assetType: 'models'
      })

      // Get the onSelect handler
      const dialogCall = mockShowDialog.mock.calls[0][0]
      const onSelectHandler = dialogCall.props.onSelect

      // Simulate asset selection
      onSelectHandler(mockAsset)

      // Should close dialog
      expect(mockCloseDialog).toHaveBeenCalledWith({
        key: 'global-asset-browser'
      })
    })

    it('uses custom title when provided', async () => {
      const mockShowDialog = vi.fn()
      const mockCloseDialog = vi.fn()

      vi.mocked(useDialogStore).mockReturnValue({
        showDialog: mockShowDialog,
        closeDialog: mockCloseDialog
      } as Partial<ReturnType<typeof useDialogStore>> as ReturnType<
        typeof useDialogStore
      >)

      const assetBrowserDialog = useAssetBrowserDialog()
      await assetBrowserDialog.browse({
        assetType: 'models',
        title: 'Custom Model Browser'
      })

      const dialogCall = mockShowDialog.mock.calls[0][0]
      expect(dialogCall.props.title).toBe('Custom Model Browser')
    })

    it('calls getAssetsByTag with correct assetType parameter', async () => {
      const mockShowDialog = vi.fn()
      const mockCloseDialog = vi.fn()

      vi.mocked(useDialogStore).mockReturnValue({
        showDialog: mockShowDialog,
        closeDialog: mockCloseDialog
      } as Partial<ReturnType<typeof useDialogStore>> as ReturnType<
        typeof useDialogStore
      >)

      mockGetAssetsByTag.mockClear()

      const assetBrowserDialog = useAssetBrowserDialog()
      await assetBrowserDialog.browse({
        assetType: 'models'
      })

      expect(mockGetAssetsByTag).toHaveBeenCalledWith('models')
    })

    it('passes fetched assets to dialog props', async () => {
      const mockShowDialog = vi.fn()
      const mockCloseDialog = vi.fn()
      const mockAssets = [
        createMockAsset({ id: 'asset-1', name: 'model1.safetensors' }),
        createMockAsset({ id: 'asset-2', name: 'model2.safetensors' })
      ]

      vi.mocked(useDialogStore).mockReturnValue({
        showDialog: mockShowDialog,
        closeDialog: mockCloseDialog
      } as Partial<ReturnType<typeof useDialogStore>> as ReturnType<
        typeof useDialogStore
      >)

      mockGetAssetsByTag.mockResolvedValueOnce(mockAssets)

      const assetBrowserDialog = useAssetBrowserDialog()
      await assetBrowserDialog.browse({
        assetType: 'models'
      })

      const dialogCall = mockShowDialog.mock.calls[0][0]
      expect(dialogCall.props.assets).toEqual(mockAssets)
    })

    it('handles asset fetch errors gracefully', async () => {
      const mockShowDialog = vi.fn()
      const mockCloseDialog = vi.fn()
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      vi.mocked(useDialogStore).mockReturnValue({
        showDialog: mockShowDialog,
        closeDialog: mockCloseDialog
      } as Partial<ReturnType<typeof useDialogStore>> as ReturnType<
        typeof useDialogStore
      >)

      mockGetAssetsByTag.mockRejectedValueOnce(new Error('Network error'))

      const assetBrowserDialog = useAssetBrowserDialog()
      await assetBrowserDialog.browse({
        assetType: 'models'
      })

      // Should still open dialog with empty assets
      expect(mockShowDialog).toHaveBeenCalled()
      const dialogCall = mockShowDialog.mock.calls[0][0]
      expect(dialogCall.props.assets).toEqual([])

      // Should log error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch assets for tag:',
        'models',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe('.show() title formatting', () => {
    it('formats title with VAE acronym uppercase', async () => {
      const { mockShowDialog } = setupDialogMocks()
      mockGetAssetsForNodeType.mockResolvedValueOnce([
        createMockAsset({ tags: ['models', 'vae'] })
      ])

      const assetBrowserDialog = useAssetBrowserDialog()
      await assetBrowserDialog.show({
        nodeType: 'VAELoader',
        inputName: 'vae_name'
      })

      const dialogCall = mockShowDialog.mock.calls[0][0]
      expect(dialogCall.props.title).toContain('VAE')
    })

    it('replaces underscores with spaces in tag names', async () => {
      const { mockShowDialog } = setupDialogMocks()
      mockGetAssetsForNodeType.mockResolvedValueOnce([
        createMockAsset({ tags: ['models', 'style_models'] })
      ])

      const assetBrowserDialog = useAssetBrowserDialog()
      await assetBrowserDialog.show({
        nodeType: 'StyleModelLoader',
        inputName: 'style_model_name'
      })

      const dialogCall = mockShowDialog.mock.calls[0][0]
      expect(dialogCall.props.title).toContain('style models')
    })
  })
})
