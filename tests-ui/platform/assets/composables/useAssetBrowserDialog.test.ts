import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAssetBrowserDialog } from '@/platform/assets/composables/useAssetBrowserDialog'

// Mock the dialog store
let mockShowDialog: ReturnType<typeof vi.fn>
let mockCloseDialog: ReturnType<typeof vi.fn>

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: vi.fn(() => ({
    showDialog: mockShowDialog,
    closeDialog: mockCloseDialog
  }))
}))

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
  let assetBrowserDialog: ReturnType<typeof useAssetBrowserDialog>

  beforeEach(() => {
    mockShowDialog = vi.fn()
    mockCloseDialog = vi.fn()
    assetBrowserDialog = useAssetBrowserDialog()
  })

  describe('Asset Selection Flow', () => {
    it('auto-closes dialog when asset is selected', () => {
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
