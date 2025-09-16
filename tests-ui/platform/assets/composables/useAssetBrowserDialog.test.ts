import { describe, expect, it, vi } from 'vitest'

import { useAssetBrowserDialog } from '@/platform/assets/composables/useAssetBrowserDialog'
import { useDialogStore } from '@/stores/dialogStore'

// Mock the dialog store
vi.mock('@/stores/dialogStore')

// Test factory functions
interface AssetBrowserProps {
  nodeType: string
  inputName: string
  onAssetSelected?: ReturnType<typeof vi.fn>
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
    it('auto-closes dialog when asset is selected', () => {
      // Create fresh mocks for this test
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
      const props = createAssetBrowserProps({ onAssetSelected })

      assetBrowserDialog.show(props)

      // Get the onSelect handler that was passed to the dialog
      const dialogCall = mockShowDialog.mock.calls[0][0]
      const onSelectHandler = dialogCall.props.onSelect

      // Simulate asset selection
      onSelectHandler('selected-asset-path')

      // Should call the original callback and close dialog
      expect(onAssetSelected).toHaveBeenCalledWith('selected-asset-path')
      expect(mockCloseDialog).toHaveBeenCalledWith({
        key: 'global-asset-browser'
      })
    })

    it('closes dialog when close handler is called', () => {
      // Create fresh mocks for this test
      const mockShowDialog = vi.fn()
      const mockCloseDialog = vi.fn()

      vi.mocked(useDialogStore).mockReturnValue({
        showDialog: mockShowDialog,
        closeDialog: mockCloseDialog
      } as Partial<ReturnType<typeof useDialogStore>> as ReturnType<
        typeof useDialogStore
      >)

      const assetBrowserDialog = useAssetBrowserDialog()
      const props = createAssetBrowserProps()

      assetBrowserDialog.show(props)

      // Get the onClose handler that was passed to the dialog
      const dialogCall = mockShowDialog.mock.calls[0][0]
      const onCloseHandler = dialogCall.props.onClose

      // Simulate dialog close
      onCloseHandler()

      expect(mockCloseDialog).toHaveBeenCalledWith({
        key: 'global-asset-browser'
      })
    })
  })
})
