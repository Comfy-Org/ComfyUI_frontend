import { describe, expect, it, vi } from 'vitest'

import { useAssetBrowserDialog } from '@/platform/assets/composables/useAssetBrowserDialog'
import { useDialogStore } from '@/stores/dialogStore'

// Mock the dialog store
vi.mock('@/stores/dialogStore')

// Mock the asset service
vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    getAssetsForNodeType: vi.fn().mockResolvedValue([])
  }
}))

// Test factory functions
interface AssetBrowserProps {
  nodeType: string
  inputName: string
  onAssetSelected?: (filename: string) => void
}

function createAssetBrowserProps(
  overrides: Partial<AssetBrowserProps> = {}
): AssetBrowserProps {
  return {
    nodeType: 'CheckpointLoaderSimple',
    inputName: 'ckpt_name',
    ...overrides
  }
}

describe('useAssetBrowserDialog', () => {
  describe('Asset Selection Flow', () => {
    it('auto-closes dialog when asset is selected', async () => {
      // Create fresh mocks for this test
      const mockShowDialog = vi.fn()
      const mockAnimateHide = vi.fn()

      vi.mocked(useDialogStore).mockReturnValue({
        showDialog: mockShowDialog,
        animateHide: mockAnimateHide
      } as Partial<ReturnType<typeof useDialogStore>> as ReturnType<
        typeof useDialogStore
      >)

      const assetBrowserDialog = useAssetBrowserDialog()
      const onAssetSelected = vi.fn()
      const props = createAssetBrowserProps({ onAssetSelected })

      await assetBrowserDialog.show(props)

      // Get the onSelect handler that was passed to the dialog
      const dialogCall = mockShowDialog.mock.calls[0][0]
      const onSelectHandler = dialogCall.props.onSelect

      // Simulate asset selection
      onSelectHandler('selected-asset-path')

      // Should call the original callback and trigger hide animation
      expect(onAssetSelected).toHaveBeenCalledWith('selected-asset-path')
      expect(mockAnimateHide).toHaveBeenCalledWith({
        key: 'global-asset-browser'
      })
    })

    it('closes dialog when close handler is called', async () => {
      // Create fresh mocks for this test
      const mockShowDialog = vi.fn()
      const mockAnimateHide = vi.fn()

      vi.mocked(useDialogStore).mockReturnValue({
        showDialog: mockShowDialog,
        animateHide: mockAnimateHide
      } as Partial<ReturnType<typeof useDialogStore>> as ReturnType<
        typeof useDialogStore
      >)

      const assetBrowserDialog = useAssetBrowserDialog()
      const props = createAssetBrowserProps()

      await assetBrowserDialog.show(props)

      // Get the onClose handler that was passed to the dialog
      const dialogCall = mockShowDialog.mock.calls[0][0]
      const onCloseHandler = dialogCall.props.onClose

      // Simulate dialog close
      onCloseHandler()

      expect(mockAnimateHide).toHaveBeenCalledWith({
        key: 'global-asset-browser'
      })
    })
  })
})
